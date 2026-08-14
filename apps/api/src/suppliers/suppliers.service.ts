import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePublicCode(value: string) {
    return value.trim().toUpperCase();
  }

  private async nextSupplierCode(businessId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { businessId, code: { startsWith: 'SUP-' } },
      select: { code: true },
    });
    const nextSequence =
      suppliers.reduce((highest, supplier) => {
        const match = /^SUP-(\d+)$/.exec(supplier.code);
        if (!match) return highest;
        return Math.max(highest, Number(match[1]));
      }, 0) + 1;
    return `SUP-${String(nextSequence).padStart(3, '0')}`;
  }

  private async findSupplierByIdOrCode(businessId: string, idOrCode: string) {
    const code = this.normalizePublicCode(idOrCode);
    return this.prisma.supplier.findFirst({
      where: {
        businessId,
        OR: [{ id: idOrCode }, { code }],
      },
    });
  }

  async list(
    businessId: string,
    includeInactive = false,
    includeSummary = false,
    from?: string,
    to?: string,
  ) {
    const where = {
      businessId,
      ...(includeInactive ? {} : { isActive: true }),
    };
    if (!includeSummary)
      return this.prisma.supplier.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      });
    const start = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
    const end = to ? new Date(`${to}T23:59:59.999Z`) : undefined;
    if (
      (start && Number.isNaN(start.getTime())) ||
      (end && Number.isNaN(end.getTime())) ||
      (start && end && start > end)
    )
      throw new BadRequestException(
        'Choose a valid supplier performance date range.',
      );
    const dateWhere =
      start || end
        ? {
            createdAt: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {};
    const suppliers = await this.prisma.supplier.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { catalogItems: true } },
        purchaseOrders: {
          where: dateWhere,
          select: {
            createdAt: true,
            status: true,
          },
        },
        receipts: {
          where: dateWhere,
          select: { quantity: true, unitCost: true },
        },
        invoices: {
          where: dateWhere,
          select: { total: true, payments: { select: { amount: true } } },
        },
      },
    });
    return suppliers.map(
      ({ _count, purchaseOrders, receipts, invoices, ...supplier }) => ({
        ...supplier,
        summary: {
          activeProductLinks: _count.catalogItems,
          lastOrderAt: purchaseOrders
            .filter((order) => order.status !== 'CANCELLED')
            .reduce<Date | null>(
              (latest, order) =>
                !latest || order.createdAt > latest ? order.createdAt : latest,
              null,
            ),
          receivedSpend: receipts.reduce(
            (total, receipt) =>
              total + receipt.quantity * (receipt.unitCost ?? 0),
            0,
          ),
          openInvoiceBalance: invoices.reduce(
            (total, invoice) =>
              total +
              Math.max(
                0,
                invoice.total -
                  invoice.payments.reduce(
                    (paid, payment) => paid + payment.amount,
                    0,
                  ),
              ),
            0,
          ),
        },
      }),
    );
  }
  async catalog(businessId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, businessId, isActive: true },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');
    return this.prisma.supplierCatalogItem.findMany({
      where: { businessId, supplierId },
      select: {
        productId: true,
        variantId: true,
        supplierSku: true,
        lastCost: true,
        isPreferred: true,
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, name: true, sku: true } },
      },
      orderBy: [{ isPreferred: 'desc' }, { product: { name: 'asc' } }],
    });
  }
  async detail(businessId: string, supplierId: string) {
    const supplier = await this.findSupplierByIdOrCode(businessId, supplierId);
    if (!supplier) throw new NotFoundException('Supplier not found.');
    const resolvedSupplierId = supplier.id;
    const [catalogItems, purchaseOrders, receipts, invoices] =
      await Promise.all([
        this.prisma.supplierCatalogItem.findMany({
          where: { businessId, supplierId: resolvedSupplierId },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
          orderBy: [{ isPreferred: 'desc' }, { product: { name: 'asc' } }],
          take: 50,
        }),
        this.prisma.purchaseOrder.findMany({
          where: { businessId, supplierId: resolvedSupplierId },
          select: {
            id: true,
            reference: true,
            status: true,
            createdAt: true,
            items: {
              select: {
                quantityOrdered: true,
                quantityReceived: true,
                unitCost: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.stockReceipt.findMany({
          where: { businessId, supplierId: resolvedSupplierId },
          select: {
            id: true,
            createdAt: true,
            quantity: true,
            unitCost: true,
            reference: true,
            product: { select: { name: true, sku: true } },
            variant: { select: { name: true, sku: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.supplierInvoice.findMany({
          where: { businessId, supplierId: resolvedSupplierId },
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            dueDate: true,
            status: true,
            createdAt: true,
            payments: { select: { amount: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);
    return { supplier, catalogItems, purchaseOrders, receipts, invoices };
  }
  async create(
    businessId: string,
    actorId: string,
    input: { name: string; phone?: string; email?: string; address?: string },
  ) {
    try {
      const supplier = await this.prisma.supplier.create({
        data: {
          businessId,
          code: await this.nextSupplierCode(businessId),
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          address: input.address?.trim() || null,
        },
      });
      await this.prisma.auditLog.create({
        data: {
          businessId,
          actorId,
          action: 'SUPPLIER_CREATED',
          entityType: 'Supplier',
          entityId: supplier.id,
        },
      });
      return supplier;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'A supplier with this name already exists.',
        );
      throw error;
    }
  }
  async update(
    businessId: string,
    actorId: string,
    supplierId: string,
    input: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      isActive?: boolean;
    },
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');
    const data = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined
        ? { phone: input.phone.trim() || null }
        : {}),
      ...(input.email !== undefined
        ? { email: input.email.trim() || null }
        : {}),
      ...(input.address !== undefined
        ? { address: input.address.trim() || null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
    try {
      const updated = await this.prisma.supplier.update({
        where: { id: supplier.id },
        data,
      });
      await this.prisma.auditLog.create({
        data: {
          businessId,
          actorId,
          action:
            input.isActive === false
              ? 'SUPPLIER_DEACTIVATED'
              : 'SUPPLIER_UPDATED',
          entityType: 'Supplier',
          entityId: supplier.id,
        },
      });
      return updated;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'A supplier with this name already exists.',
        );
      throw error;
    }
  }
}
