import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
type Checkout = {
  branchId: string;
  customerId?: string;
  clientTransactionId?: string;
  exchangeSourceSaleId?: string;
  exchangeCredit?: number;
  paymentMethod: string;
  giftCardCode?: string;
  amountTendered?: number;
  discountTotal?: number;
  promotionId?: string;
  managerApprovalToken?: string;
  note?: string;
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    modifierOptionIds?: string[];
    note?: string;
  }[];
};
type HoldSale = {
  branchId: string;
  label?: string;
  customerId?: string;
  paymentMethod: string;
  discountTotal?: number;
  note?: string;
  items: unknown[];
};
type ReturnLine = { saleItemId: string; quantity: number };
@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async catalog(businessId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found.');
    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      include: {
        category: true,
        inventory: { where: { branchId }, select: { quantity: true } },
        modifierGroups: {
          include: { options: true },
          orderBy: { createdAt: 'asc' },
        },
        variants: {
          where: { isActive: true },
          include: { inventory: { where: { branchId }, select: { quantity: true } } },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    return products.map(({ inventory, variants, ...product }) => {
      const availableVariants = variants.map(({ inventory: variantInventory, ...variant }) => ({
        ...variant,
        price: variant.price ?? variant.regularPrice ?? product.price ?? product.regularPrice ?? 0,
        stockQuantity: variantInventory[0]?.quantity ?? 0,
      }));
      return {
        ...product,
        price: product.price ?? product.regularPrice ?? 0,
        variants: availableVariants,
        // When variants exist, only variant stock is sellable. This prevents a
        // shoe's total quantity being sold without recording its size.
        stockQuantity: availableVariants.length
          ? availableVariants.reduce((sum, variant) => sum + variant.stockQuantity, 0)
          : inventory[0]?.quantity ?? 0,
      };
    });
  }
  async checkout(
    businessId: string,
    cashierId: string,
    role: string,
    input: Checkout,
  ) {
    if (!input.items.length) throw new BadRequestException('Cart is empty.');
    // A locally queued sale can be retried after the connection returns. This
    // check makes retrying safe: the same device transaction is never charged
    // or deducted from stock twice.
    if (input.clientTransactionId) {
      const existing = await this.prisma.sale.findFirst({
        where: { businessId, clientTransactionId: input.clientTransactionId },
        include: { items: { include: { product: true } } },
      });
      if (existing) return existing;
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found.');
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { taxRateBasisPoints: true },
    });
    if (
      input.customerId &&
      !(await this.prisma.customer.findFirst({
        where: { id: input.customerId, businessId },
      }))
    )
      throw new NotFoundException('Customer not found.');
    const activeShift = await this.prisma.cashShift.findFirst({
      where: {
        businessId,
        branchId: input.branchId,
        cashierId,
        closedAt: null,
      },
    });
    if (!activeShift)
      throw new BadRequestException('Open a shift before completing a sale.');
    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        id: { in: input.items.map((i) => i.productId) },
        isActive: true,
      },
      include: {
        modifierGroups: { include: { options: true } },
        variants: true,
      },
    });
    if (products.length !== input.items.length)
      throw new BadRequestException('One or more products are unavailable.');
    return this.prisma.$transaction(async (tx) => {
      const lines = input.items.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        const selectedIds = item.modifierOptionIds ?? [];
        const groups = product.modifierGroups;
        const selected = groups.flatMap((group) =>
          group.options
            .filter((option) => selectedIds.includes(option.id))
            .map((option) => ({ group, option })),
        );
        if (selected.length !== new Set(selectedIds).size)
          throw new BadRequestException(
            'One or more selected modifiers are invalid.',
          );
        for (const group of groups) {
          const count = selected.filter(
            (entry) => entry.group.id === group.id,
          ).length;
          if (count < group.minSelections || count > group.maxSelections)
            throw new BadRequestException(
              `${product.name}: choose ${group.minSelections === group.maxSelections ? group.minSelections : `${group.minSelections}-${group.maxSelections}`} option(s) for ${group.name}.`,
            );
        }
        const variant = item.variantId
          ? product.variants.find((candidate) => candidate.id === item.variantId && candidate.isActive)
          : undefined;
        if (item.variantId && !variant)
          throw new BadRequestException(`${product.name}: the selected variant is unavailable.`);
        if (!item.variantId && product.variants.length)
          throw new BadRequestException(`${product.name}: choose a size or variant.`);
        const modifierTotal = selected.reduce(
          (sum, entry) => sum + entry.option.priceAdjustment,
          0,
        );
        const unitPrice = (variant?.price ?? variant?.regularPrice ?? product.price ?? product.regularPrice ?? 0) + modifierTotal;
        return {
          ...item,
          unitPrice,
          unitCost: variant?.cost ?? product.cost ?? null,
          lineTotal: unitPrice * item.quantity,
          modifiers: selected.map((entry) => ({
            group: entry.group.name,
            name: entry.option.name,
            priceAdjustment: entry.option.priceAdjustment,
          })),
          note: item.note?.trim().replace(/\s+/g, ' ') || null,
        };
      });
      for (const line of lines) {
        const stock = line.variantId
          ? await tx.productVariantInventory.findUnique({
              where: { branchId_variantId: { branchId: input.branchId, variantId: line.variantId } },
            })
          : await tx.inventoryItem.findUnique({
              where: { branchId_productId: { branchId: input.branchId, productId: line.productId } },
            });
        if (!stock || stock.quantity < line.quantity) {
          const product = products.find((item) => item.id === line.productId)!;
          throw new BadRequestException(
            `${product.name}: requested ${line.quantity}, available ${stock?.quantity ?? 0} at this branch.`,
          );
        }
      }
      const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
      const manualDiscountTotal = input.discountTotal ?? 0;
      let promotionDiscountTotal = 0;
      if (input.promotionId) {
        const promotion = await tx.promotion.findFirst({
          where: { id: input.promotionId, businessId, isActive: true },
        });
        const now = new Date();
        if (!promotion || (promotion.startsAt && promotion.startsAt > now) || (promotion.endsAt && promotion.endsAt < now))
          throw new BadRequestException('This promotion is no longer available.');
        if (subtotal < promotion.minimumSpend)
          throw new BadRequestException('This promotion requires a higher order total.');
        const eligibleSubtotal = lines.filter((line) => {
          const product = products.find((item) => item.id === line.productId)!;
          return (!promotion.productId || promotion.productId === line.productId) && (!promotion.categoryId || promotion.categoryId === product.categoryId);
        }).reduce((sum, line) => sum + line.lineTotal, 0);
        if (eligibleSubtotal < 1) throw new BadRequestException('This promotion does not match items in the cart.');
        promotionDiscountTotal = promotion.type === 'BUY_X_GET_Y'
          ? lines.filter((line) => line.productId === promotion.productId).reduce((sum, line) => sum + Math.floor(line.quantity / (promotion.buyQuantity + promotion.rewardQuantity)) * promotion.rewardQuantity * line.unitPrice, 0)
          : promotion.type === 'PERCENT'
          ? Math.floor((eligibleSubtotal * promotion.value) / 10000)
          : promotion.value;
        promotionDiscountTotal = Math.min(eligibleSubtotal, promotionDiscountTotal);
      }
      const discountTotal = manualDiscountTotal + promotionDiscountTotal;
      let discountApproval: { approvedBy: string } | null = null;
      if (manualDiscountTotal > 0 && !['OWNER', 'MANAGER'].includes(role)) {
        if (!input.managerApprovalToken)
          throw new ForbiddenException('A manager PIN approval is required for this discount.');
        try {
          const approval = await this.jwt.verifyAsync<{
            purpose: string; action: string; businessId: string; branchId: string | null; cashierId: string; approvedBy: string;
          }>(input.managerApprovalToken);
          if (approval.purpose !== 'MANAGER_APPROVAL' || approval.action !== 'DISCOUNT' || approval.businessId !== businessId || (approval.branchId !== null && approval.branchId !== input.branchId) || approval.cashierId !== cashierId)
            throw new Error('Approval does not match this sale.');
          discountApproval = { approvedBy: approval.approvedBy };
        } catch {
          throw new ForbiddenException('Manager approval is invalid or expired. Ask the manager to approve the discount again.');
        }
      }
      if (discountTotal > subtotal)
        throw new BadRequestException('Discount cannot exceed the subtotal.');
      const beforeExchangeCredit = subtotal - discountTotal;
      let exchangeCredit = 0;
      if (input.exchangeCredit && input.exchangeSourceSaleId) {
        const sourceSale = await tx.sale.findFirst({
          where: { id: input.exchangeSourceSaleId, businessId },
          include: { items: true },
        });
        if (!sourceSale)
          throw new BadRequestException(
            'The exchange source sale was not found.',
          );
        const returnedValue = sourceSale.items.reduce(
          (sum, item) => sum + item.unitPrice * item.returnedQuantity,
          0,
        );
        const usedCredit = await tx.sale.aggregate({
          where: { businessId, exchangeSourceSaleId: sourceSale.id },
          _sum: { exchangeCredit: true },
        });
        const availableCredit = Math.max(
          0,
          returnedValue - (usedCredit._sum.exchangeCredit ?? 0),
        );
        exchangeCredit = Math.min(
          input.exchangeCredit,
          availableCredit,
          beforeExchangeCredit,
        );
        if (exchangeCredit < 1)
          throw new BadRequestException(
            'There is no available exchange credit for this sale.',
          );
      } else if (input.exchangeCredit || input.exchangeSourceSaleId) {
        throw new BadRequestException(
          'Exchange credit requires its original sale.',
        );
      }
      const taxTotal = Math.round(
        (beforeExchangeCredit * business.taxRateBasisPoints) / 10000,
      );
      const total = beforeExchangeCredit + taxTotal - exchangeCredit;
      const amountTendered =
        input.paymentMethod === 'CASH'
          ? (input.amountTendered ?? total)
          : total;
      if (input.paymentMethod === 'GIFT_CARD') {
        const card = await tx.giftCard.findFirst({ where: { businessId, code: input.giftCardCode?.trim().toUpperCase(), isActive: true } });
        if (!card || card.balance < total) throw new BadRequestException('Gift card balance is not enough.');
        await tx.giftCard.update({ where: { id: card.id }, data: { balance: { decrement: total } } });
      }
      if (amountTendered < total)
        throw new BadRequestException(
          'Cash received must cover the sale total.',
        );
      const sale = await tx.sale.create({
        data: {
          businessId,
          clientTransactionId: input.clientTransactionId,
          branchId: input.branchId,
          cashierId,
          cashShiftId: activeShift.id,
          customerId: input.customerId,
          exchangeSourceSaleId: input.exchangeSourceSaleId,
          exchangeCredit,
          paymentMethod: input.paymentMethod,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          amountTendered,
          changeDue: amountTendered - total,
          note: input.note?.trim().replace(/\s+/g, ' ') || null,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
              lineTotal: line.lineTotal,
              modifiers: line.modifiers,
              note: line.note,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });
      if (discountApproval) await tx.auditLog.create({
        data: { businessId, actorId: discountApproval.approvedBy, action: 'DISCOUNT_APPROVED_AT_CHECKOUT', entityType: 'Sale', entityId: sale.id, metadata: { cashierId, discountTotal, branchId: input.branchId } },
      });
      for (const line of lines) {
        if (line.variantId) {
          await tx.productVariantInventory.update({
            where: { branchId_variantId: { branchId: input.branchId, variantId: line.variantId } },
            data: { quantity: { decrement: line.quantity } },
          });
        } else {
          const stock = await tx.inventoryItem.update({
            where: { branchId_productId: { branchId: input.branchId, productId: line.productId } },
            data: { quantity: { decrement: line.quantity } },
          });
          await tx.stockMovement.create({
            data: { inventoryItemId: stock.id, quantityChange: -line.quantity, reason: 'SALE', actorId: cashierId },
          });
        }
      }
      return sale;
    });
  }
  async held(businessId: string, branchId: string) {
    return this.prisma.heldSale.findMany({
      where: { businessId, branchId },
      include: { cashier: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async hold(businessId: string, cashierId: string, input: HoldSale) {
    if (!input.items.length) throw new BadRequestException('Cart is empty.');
    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found.');
    const held = await this.prisma.heldSale.create({
      data: {
        businessId,
        branchId: input.branchId,
        cashierId,
        label:
          input.label?.trim() || `Held sale ${new Date().toLocaleTimeString()}`,
        customerId: input.customerId,
        paymentMethod: input.paymentMethod,
        discountTotal: input.discountTotal ?? 0,
        note: input.note?.trim().replace(/\s+/g, ' ') || null,
        items: input.items as object[],
      },
      include: { cashier: { select: { firstName: true, lastName: true } } },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId: cashierId,
        action: 'SALE_HELD',
        entityType: 'HeldSale',
        entityId: held.id,
      },
    });
    return held;
  }
  async removeHeld(businessId: string, id: string) {
    const held = await this.prisma.heldSale.findFirst({
      where: { id, businessId },
    });
    if (!held) throw new NotFoundException('Held sale not found.');
    await this.prisma.heldSale.delete({ where: { id } });
    return { message: 'Held sale resumed.' };
  }
  async refund(
    businessId: string,
    saleId: string,
    actorId: string,
    role: string,
    reason: string,
    managerApprovalToken?: string,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Sale not found.');
    if (sale.refundedAt)
      throw new BadRequestException('This sale was already refunded.');
    const approvedBy = await this.returnApprover(businessId, sale.branchId, actorId, role, managerApprovalToken);
    return this.prisma.$transaction(async (tx) => {
      const refunded = await tx.sale.update({
        where: { id: sale.id },
        data: {
          refundedAt: new Date(),
          refundedById: approvedBy,
          refundReason: reason,
        },
      });
      for (const item of sale.items) {
        await tx.saleItem.update({
          where: { id: item.id },
          data: { returnedQuantity: item.quantity },
        });
        if (item.variantId) {
          await tx.productVariantInventory.upsert({
            where: { branchId_variantId: { branchId: sale.branchId, variantId: item.variantId } },
            create: { branchId: sale.branchId, variantId: item.variantId, quantity: item.quantity },
            update: { quantity: { increment: item.quantity } },
          });
        } else {
          const inventory = await tx.inventoryItem.update({
            where: { branchId_productId: { branchId: sale.branchId, productId: item.productId } },
            data: { quantity: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: { inventoryItemId: inventory.id, quantityChange: item.quantity, reason: 'REFUND', actorId },
          });
        }
      }
      await tx.auditLog.create({
        data: {
          businessId,
          actorId: approvedBy,
          action: 'SALE_REFUNDED',
          entityType: 'Sale',
          entityId: sale.id,
          metadata: { reason, requestedBy: actorId, approvedBy },
        },
      });
      return refunded;
    });
  }
  async returnItems(
    businessId: string,
    saleId: string,
    actorId: string,
    role: string,
    reason: string,
    lines: ReturnLine[],
    managerApprovalToken?: string,
  ) {
    if (!lines.length)
      throw new BadRequestException('Choose at least one item to return.');
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Sale not found.');
    if (sale.refundedAt)
      throw new BadRequestException('This sale was already fully returned.');
    const approvedBy = await this.returnApprover(businessId, sale.branchId, actorId, role, managerApprovalToken);
    const uniqueIds = new Set(lines.map((line) => line.saleItemId));
    if (uniqueIds.size !== lines.length)
      throw new BadRequestException(
        'Each sale item can only be returned once per request.',
      );
    return this.prisma.$transaction(async (tx) => {
      let returnedTotal = 0;
      for (const line of lines) {
        const item = sale.items.find(
          (candidate) => candidate.id === line.saleItemId,
        );
        if (!item)
          throw new BadRequestException(
            'One selected item is not part of this sale.',
          );
        const available = item.quantity - item.returnedQuantity;
        if (line.quantity > available)
          throw new BadRequestException(
            `Only ${available} of this item can still be returned.`,
          );
        await tx.saleItem.update({
          where: { id: item.id },
          data: { returnedQuantity: { increment: line.quantity } },
        });
        if (item.variantId) {
          await tx.productVariantInventory.upsert({
            where: { branchId_variantId: { branchId: sale.branchId, variantId: item.variantId } },
            create: { branchId: sale.branchId, variantId: item.variantId, quantity: line.quantity },
            update: { quantity: { increment: line.quantity } },
          });
        } else {
          const inventory = await tx.inventoryItem.update({
            where: { branchId_productId: { branchId: sale.branchId, productId: item.productId } },
            data: { quantity: { increment: line.quantity } },
          });
          await tx.stockMovement.create({
            data: { inventoryItemId: inventory.id, quantityChange: line.quantity, reason: 'REFUND', actorId },
          });
        }
        returnedTotal += item.unitPrice * line.quantity;
      }
      const updatedItems = await tx.saleItem.findMany({
        where: { saleId: sale.id },
      });
      const fullyReturned = updatedItems.every(
        (item) => item.returnedQuantity >= item.quantity,
      );
      if (fullyReturned) {
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            refundedAt: new Date(),
            refundedById: approvedBy,
            refundReason: reason,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          businessId,
          actorId: approvedBy,
          action: 'SALE_ITEMS_RETURNED',
          entityType: 'Sale',
          entityId: sale.id,
          metadata: { reason, lines, returnedTotal, fullyReturned, requestedBy: actorId, approvedBy },
        },
      });
      return {
        message: 'Return recorded. Stock was restored.',
        returnedTotal,
        fullyReturned,
      };
    });
  }
  private async returnApprover(
    businessId: string,
    branchId: string,
    cashierId: string,
    role: string,
    managerApprovalToken?: string,
  ) {
    if (role === 'OWNER' || role === 'MANAGER') return cashierId;
    if (!managerApprovalToken)
      throw new ForbiddenException('A manager PIN approval is required for this return.');
    try {
      const approval = await this.jwt.verifyAsync<{
        purpose: string;
        action: string;
        businessId: string;
        branchId: string | null;
        cashierId: string;
        approvedBy: string;
      }>(managerApprovalToken);
      if (
        approval.purpose !== 'MANAGER_APPROVAL' ||
        approval.action !== 'RETURN' ||
        approval.businessId !== businessId ||
        (approval.branchId !== null && approval.branchId !== branchId) ||
        approval.cashierId !== cashierId
      ) throw new Error('Approval does not match this return.');
      return approval.approvedBy;
    } catch {
      throw new ForbiddenException('Manager approval is invalid or expired. Ask the manager to approve this return again.');
    }
  }
  async history(businessId: string, userId: string, role: string, input: { page?: number; pageSize?: number; status?: 'all' | 'completed' | 'returned'; from?: string; to?: string } = {}) {
    const page = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page!)) : 1;
    const pageSize = Number.isFinite(input.pageSize) ? Math.min(100, Math.max(1, Math.floor(input.pageSize!))) : 25;
    const from = input.from && /^\d{4}-\d{2}-\d{2}$/.test(input.from) ? new Date(`${input.from}T00:00:00`) : undefined;
    const to = input.to && /^\d{4}-\d{2}-\d{2}$/.test(input.to) ? new Date(`${input.to}T23:59:59.999`) : undefined;
    const baseWhere = { businessId, ...(role === 'CASHIER' ? { cashierId: userId } : {}), ...((from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) };
    const returnedWhere = { OR: [{ refundedAt: { not: null } }, { items: { some: { returnedQuantity: { gt: 0 } } } }] };
    const statusWhere = input.status === 'returned' ? returnedWhere : input.status === 'completed' ? { refundedAt: null, items: { none: { returnedQuantity: { gt: 0 } } } } : {};
    const where = { ...baseWhere, ...statusWhere };
    const [items, total, totals] = await this.prisma.$transaction([
      this.prisma.sale.findMany({ where, include: { branch: true, business: true, items: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.sale.count({ where }),
      this.prisma.sale.aggregate({ where, _sum: { total: true } }),
    ]);
    const returnedCount = input.status === 'completed' ? 0 : input.status === 'returned' ? total : await this.prisma.sale.count({ where: { ...baseWhere, ...returnedWhere } });
    return { items, total, page, pageSize, summary: { totalValue: totals._sum.total ?? 0, returnedCount } };
  }
  async receipt(businessId: string, id: string, userId: string, role: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId, ...(role === 'CASHIER' ? { cashierId: userId } : {}) },
      include: {
        branch: true,
        business: true,
        items: { include: { product: true } },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found.');
    return sale;
  }
}
