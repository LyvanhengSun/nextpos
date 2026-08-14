import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
@Injectable()
export class SupplierInvoicesService {
  constructor(private readonly prisma: PrismaService) {}
  async list(businessId: string) {
    const invoices = await this.prisma.supplierInvoice.findMany({
      where: { businessId },
      include: {
        supplier: { select: { id: true, name: true } },
        branch: { select: { name: true } },
        purchaseOrder: {
          select: {
            reference: true,
            items: {
              select: {
                quantityOrdered: true,
                quantityReceived: true,
                unitCost: true,
              },
            },
          },
        },
        payments: { orderBy: { paidAt: 'desc' } },
        credits: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return invoices.map((invoice) => {
      const items = invoice.purchaseOrder?.items;
      if (!items) return { ...invoice, match: null };
      const orderedTotal = items.reduce(
        (sum, item) => sum + item.quantityOrdered * (item.unitCost ?? 0),
        0,
      );
      const receivedTotal = items.reduce(
        (sum, item) => sum + item.quantityReceived * (item.unitCost ?? 0),
        0,
      );
      const hasUnreceivedQuantity = items.some(
        (item) => item.quantityReceived < item.quantityOrdered,
      );
      return {
        ...invoice,
        match: {
          orderedTotal,
          receivedTotal,
          invoiceVariance: invoice.total - orderedTotal,
          receiptVariance: invoice.total - receivedTotal,
          hasUnreceivedQuantity,
        },
      };
    });
  }
  async create(
    businessId: string,
    branchId: string,
    actorId: string,
    input: {
      supplierId: string;
      invoiceNumber: string;
      total: number;
      dueDate?: string;
      purchaseOrderId?: string;
      note?: string;
    },
  ) {
    const [supplier, order] = await Promise.all([
      this.prisma.supplier.findFirst({
        where: { id: input.supplierId, businessId, isActive: true },
      }),
      input.purchaseOrderId
        ? this.prisma.purchaseOrder.findFirst({
            where: { id: input.purchaseOrderId, businessId },
          })
        : null,
    ]);
    if (!supplier || (input.purchaseOrderId && !order))
      throw new NotFoundException('Supplier or purchase order not found.');
    if (order && order.supplierId !== supplier.id)
      throw new BadRequestException(
        'The selected purchase order belongs to another supplier.',
      );
    try {
      const invoice = await this.prisma.supplierInvoice.create({
        data: {
          businessId,
          branchId,
          supplierId: input.supplierId,
          purchaseOrderId: input.purchaseOrderId || null,
          invoiceNumber: input.invoiceNumber.trim(),
          total: input.total,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          note: input.note?.trim() || null,
          createdById: actorId,
        },
        include: { supplier: { select: { name: true } }, payments: true },
      });
      await this.prisma.auditLog.create({
        data: {
          businessId,
          actorId,
          action: 'SUPPLIER_INVOICE_CREATED',
          entityType: 'SupplierInvoice',
          entityId: invoice.id,
        },
      });
      return invoice;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'This supplier invoice number already exists.',
        );
      throw error;
    }
  }
  async pay(
    businessId: string,
    actorId: string,
    actorRole: string,
    invoiceId: string,
    input: {
      amount: number;
      paymentMethod: string;
      note?: string;
      overrideReason?: string;
    },
  ) {
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id: invoiceId, businessId },
      include: {
        payments: true,
        credits: true,
        purchaseOrder: {
          include: {
            items: {
              select: {
                quantityOrdered: true,
                quantityReceived: true,
                unitCost: true,
              },
            },
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Supplier invoice not found.');
    if (invoice.disputeStatus === 'OPEN')
      throw new BadRequestException(
        'Resolve the supplier dispute before recording payment.',
      );
    const items = invoice.purchaseOrder?.items;
    const mismatch =
      !!items &&
      (items.some((item) => item.quantityReceived < item.quantityOrdered) ||
        invoice.total !==
          items.reduce(
            (sum, item) => sum + item.quantityOrdered * (item.unitCost ?? 0),
            0,
          ));
    const overrideReason = input.overrideReason?.trim();
    if (mismatch && (actorRole !== 'OWNER' || !overrideReason))
      throw new BadRequestException(
        'A mismatched invoice requires an owner override reason before payment.',
      );
    const paid = invoice.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    const credited = invoice.credits.reduce(
      (sum, credit) => sum + credit.amount,
      0,
    );
    const balance = invoice.total - paid - credited;
    if (input.amount > balance)
      throw new BadRequestException(
        `Only $${(balance / 100).toFixed(2)} remains on this invoice.`,
      );
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.supplierInvoicePayment.create({
        data: {
          supplierInvoiceId: invoice.id,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          note: input.note?.trim() || null,
          recordedById: actorId,
        },
      });
      const nextPaid = paid + input.amount;
      await tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: {
          status: nextPaid === invoice.total ? 'PAID' : 'PARTIALLY_PAID',
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorId,
          action: 'SUPPLIER_INVOICE_PAYMENT_RECORDED',
          entityType: 'SupplierInvoice',
          entityId: invoice.id,
          metadata: {
            amount: input.amount,
            paymentMethod: input.paymentMethod,
            ...(mismatch ? { mismatchOverrideReason: overrideReason } : {}),
          },
        },
      });
      return payment;
    });
  }
  async addCredit(
    businessId: string,
    actorId: string,
    invoiceId: string,
    input: { amount: number; reference?: string; note?: string },
  ) {
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id: invoiceId, businessId },
      include: { payments: true, credits: true },
    });
    if (!invoice) throw new NotFoundException('Supplier invoice not found.');
    const used =
      invoice.payments.reduce((sum, payment) => sum + payment.amount, 0) +
      invoice.credits.reduce((sum, credit) => sum + credit.amount, 0);
    if (input.amount > invoice.total - used)
      throw new BadRequestException(
        'Credit exceeds the remaining invoice balance.',
      );
    return this.prisma.$transaction(async (tx) => {
      const credit = await tx.supplierInvoiceCredit.create({
        data: {
          supplierInvoiceId: invoice.id,
          amount: input.amount,
          reference: input.reference?.trim() || null,
          note: input.note?.trim() || null,
          recordedById: actorId,
        },
      });
      if (invoice.total - used - input.amount === 0)
        await tx.supplierInvoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID' },
        });
      await tx.auditLog.create({
        data: {
          businessId,
          actorId,
          action: 'SUPPLIER_INVOICE_CREDIT_RECORDED',
          entityType: 'SupplierInvoice',
          entityId: invoice.id,
          metadata: { amount: input.amount },
        },
      });
      return credit;
    });
  }
  async dispute(
    businessId: string,
    actorId: string,
    invoiceId: string,
    input: { reason: string; reference?: string },
  ) {
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id: invoiceId, businessId },
    });
    if (!invoice) throw new NotFoundException('Supplier invoice not found.');
    const reason = input.reason.trim();
    if (!reason) throw new BadRequestException('Enter a dispute reason.');
    const updated = await this.prisma.supplierInvoice.update({
      where: { id: invoice.id },
      data: {
        disputeStatus: 'OPEN',
        disputeReason: reason,
        disputeReference: input.reference?.trim() || null,
        disputedAt: new Date(),
        resolvedAt: null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'SUPPLIER_INVOICE_DISPUTED',
        entityType: 'SupplierInvoice',
        entityId: invoice.id,
        metadata: { reason, reference: input.reference?.trim() || null },
      },
    });
    return updated;
  }
  async resolveDispute(
    businessId: string,
    actorId: string,
    invoiceId: string,
    input: { reason: string; reference?: string },
  ) {
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id: invoiceId, businessId },
    });
    if (!invoice) throw new NotFoundException('Supplier invoice not found.');
    if (invoice.disputeStatus !== 'OPEN')
      throw new BadRequestException(
        'This invoice does not have an open dispute.',
      );
    const updated = await this.prisma.supplierInvoice.update({
      where: { id: invoice.id },
      data: {
        disputeStatus: 'RESOLVED',
        disputeReference: input.reference?.trim() || invoice.disputeReference,
        resolvedAt: new Date(),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'SUPPLIER_INVOICE_DISPUTE_RESOLVED',
        entityType: 'SupplierInvoice',
        entityId: invoice.id,
        metadata: {
          resolution: input.reason.trim(),
          reference: input.reference?.trim() || null,
        },
      },
    });
    return updated;
  }
}
