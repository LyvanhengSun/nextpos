import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}
  async adjust(businessId: string, actorId: string, input: { branchId: string; productId?: string; variantId?: string; quantityChange: number; reason: string }) {
    if (input.variantId) {
      const variant = await this.prisma.productVariant.findFirst({ where: { id: input.variantId, product: { businessId } }, include: { product: true } });
      if (!variant) throw new NotFoundException('Variant not found.');
      return this.prisma.$transaction(async (tx) => {
        const item = await tx.productVariantInventory.upsert({ where: { branchId_variantId: { branchId: input.branchId, variantId: variant.id } }, create: { branchId: input.branchId, variantId: variant.id, quantity: 0 }, update: {} });
        const updated = await tx.productVariantInventory.update({ where: { id: item.id }, data: { quantity: { increment: input.quantityChange } } });
        await tx.productVariantStockMovement.create({ data: { productVariantInventoryId: item.id, quantityChange: input.quantityChange, reason: input.reason, actorId } });
        await tx.auditLog.create({ data: { businessId, actorId, action: 'VARIANT_STOCK_ADJUSTED', entityType: 'ProductVariant', entityId: variant.id, metadata: { product: variant.product.name, variant: variant.name, quantityChange: input.quantityChange, reason: input.reason } } });
        return updated;
      });
    }
    if (!input.productId) throw new BadRequestException('Choose a product or variant.');
    const productId = input.productId;
    const [branch, product] = await Promise.all([this.prisma.branch.findFirst({ where: { id: input.branchId, businessId } }), this.prisma.product.findFirst({ where: { id: input.productId, businessId } })]);
    if (!branch || !product) throw new NotFoundException('Branch or product not found.');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.upsert({ where: { branchId_productId: { branchId: input.branchId, productId } }, create: { branchId: input.branchId, productId, quantity: 0 }, update: {} });
      const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: { increment: input.quantityChange } } });
      await tx.stockMovement.create({ data: { inventoryItemId: item.id, quantityChange: input.quantityChange, reason: input.reason, actorId } });
      return updated;
    });
  }
  async stockCount(
    businessId: string,
    actorId: string,
    input: { branchId: string; productId?: string; variantId?: string; countedQuantity: number; note?: string },
  ) {
    if (input.variantId) {
      const variant = await this.prisma.productVariant.findFirst({ where: { id: input.variantId, product: { businessId } }, include: { product: true } });
      if (!variant) throw new NotFoundException('Variant not found.');
      if (!Number.isInteger(input.countedQuantity) || input.countedQuantity < 0) throw new BadRequestException('Counted quantity must be a whole number of zero or more.');
      return this.prisma.$transaction(async (tx) => {
        const item = await tx.productVariantInventory.upsert({ where: { branchId_variantId: { branchId: input.branchId, variantId: variant.id } }, create: { branchId: input.branchId, variantId: variant.id, quantity: 0 }, update: {} });
        const difference = input.countedQuantity - item.quantity;
        const updated = await tx.productVariantInventory.update({ where: { id: item.id }, data: { quantity: input.countedQuantity } });
        if (difference !== 0)
          await tx.productVariantStockMovement.create({
            data: { productVariantInventoryId: item.id, quantityChange: difference, reason: `STOCK_COUNT${input.note?.trim() ? `:${input.note.trim()}` : ''}`, actorId },
          });
        await tx.auditLog.create({ data: { businessId, actorId, action: 'VARIANT_PHYSICAL_STOCK_COUNT_RECORDED', entityType: 'ProductVariant', entityId: variant.id, metadata: { product: variant.product.name, variant: variant.name, expectedQuantity: item.quantity, countedQuantity: input.countedQuantity, difference, note: input.note?.trim() || null } } });
        return { product: `${variant.product.name} — ${variant.name}`, expectedQuantity: item.quantity, countedQuantity: input.countedQuantity, difference, item: updated };
      });
    }
    if (!input.productId) throw new BadRequestException('Choose a product or variant.');
    const productId = input.productId;
    const [branch, product] = await Promise.all([
      this.prisma.branch.findFirst({ where: { id: input.branchId, businessId } }),
      this.prisma.product.findFirst({ where: { id: input.productId, businessId } }),
    ]);
    if (!branch || !product) throw new NotFoundException('Branch or product not found.');
    if (!Number.isInteger(input.countedQuantity) || input.countedQuantity < 0)
      throw new BadRequestException('Counted quantity must be a whole number of zero or more.');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.upsert({
        where: { branchId_productId: { branchId: input.branchId, productId } },
        create: { branchId: input.branchId, productId, quantity: 0 },
        update: {},
      });
      const difference = input.countedQuantity - item.quantity;
      const updated = await tx.inventoryItem.update({
        where: { id: item.id }, data: { quantity: input.countedQuantity },
      });
      if (difference !== 0) {
        await tx.stockMovement.create({
          data: {
            inventoryItemId: item.id,
            quantityChange: difference,
            reason: `STOCK_COUNT${input.note?.trim() ? `:${input.note.trim()}` : ''}`,
            actorId,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          businessId, actorId, action: 'PHYSICAL_STOCK_COUNT_RECORDED',
          entityType: 'InventoryItem', entityId: item.id,
          metadata: { product: product.name, expectedQuantity: item.quantity, countedQuantity: input.countedQuantity, difference },
        },
      });
      return { product: product.name, expectedQuantity: item.quantity, countedQuantity: input.countedQuantity, difference, item: updated };
    });
  }
  async list(branchId: string) {
    const [products, variants] = await Promise.all([
      this.prisma.inventoryItem.findMany({ where: { branchId }, include: { product: true }, orderBy: { product: { name: 'asc' } } }),
      this.prisma.productVariantInventory.findMany({ where: { branchId }, include: { variant: { include: { product: true } } }, orderBy: { variant: { product: { name: 'asc' } } } }),
    ]);
    return [
      ...products.map((item) => ({ ...item, variant: null })),
      ...variants.map((item) => ({ ...item, product: item.variant.product, variant: { id: item.variant.id, name: item.variant.name, sku: item.variant.sku } })),
    ];
  }
  async valuation(businessId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, businessId }, select: { id: true, name: true } });
    if (!branch) throw new NotFoundException('Branch not found.');
    const [products, variants] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { branchId, quantity: { not: 0 } },
        include: { product: { select: { id: true, name: true, sku: true, cost: true } } },
      }),
      this.prisma.productVariantInventory.findMany({
        where: { branchId, quantity: { not: 0 } },
        include: { variant: { include: { product: { select: { id: true, name: true, sku: true, cost: true } } } } },
      }),
    ]);
    const rows = [
      ...products.map((item) => ({
        id: `product-${item.id}`,
        product: item.product.name,
        variant: null as string | null,
        sku: item.product.sku,
        quantity: item.quantity,
        unitCost: item.product.cost,
        costSource: item.product.cost === null ? 'Not set' : 'Product cost',
      })),
      ...variants.map((item) => {
        const unitCost = item.variant.cost ?? item.variant.product.cost;
        return {
          id: `variant-${item.id}`,
          product: item.variant.product.name,
          variant: item.variant.name,
          sku: item.variant.sku,
          quantity: item.quantity,
          unitCost,
          costSource: item.variant.cost !== null ? 'Variant cost' : item.variant.product.cost !== null ? 'Product cost' : 'Not set',
        };
      }),
    ].map((row) => ({ ...row, totalValue: row.unitCost === null ? null : row.quantity * row.unitCost }));
    const totalValue = rows.reduce((sum, row) => sum + (row.totalValue ?? 0), 0);
    const onHandUnits = rows.reduce((sum, row) => sum + row.quantity, 0);
    const missingCostItems = rows.filter((row) => row.unitCost === null && row.quantity > 0).length;
    return {
      branch,
      totalValue,
      onHandUnits,
      valuedItems: rows.filter((row) => row.unitCost !== null).length,
      missingCostItems,
      items: rows.sort((left, right) => (right.totalValue ?? -1) - (left.totalValue ?? -1) || left.product.localeCompare(right.product)),
    };
  }
  async reorderSuggestions(businessId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, businessId }, select: { id: true, name: true } });
    if (!branch) throw new NotFoundException('Branch not found.');
    const [products, variants, preferredCatalogItems] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { branchId, product: { businessId, isActive: true, reorderLevel: { gt: 0 } } },
        include: { product: { select: { id: true, name: true, sku: true, reorderLevel: true } } },
      }),
      this.prisma.productVariantInventory.findMany({
        where: { branchId, variant: { isActive: true, product: { businessId, isActive: true, reorderLevel: { gt: 0 } } } },
        include: { variant: { include: { product: { select: { id: true, name: true, sku: true, reorderLevel: true } } } } },
      }),
      this.prisma.supplierCatalogItem.findMany({
        where: { businessId, isPreferred: true },
        select: { productId: true, variantId: true, lastCost: true, supplier: { select: { id: true, name: true } } },
      }),
    ]);
    const rows = [
      ...products.map((item) => ({ productId: item.product.id, variantId: null as string | null, product: item.product.name, variant: null as string | null, sku: item.product.sku, quantity: item.quantity, alertLevel: item.product.reorderLevel })),
      ...variants.map((item) => ({ productId: item.variant.product.id, variantId: item.variant.id, product: item.variant.product.name, variant: item.variant.name, sku: item.variant.sku, quantity: item.quantity, alertLevel: item.variant.product.reorderLevel })),
    ].filter((item) => item.quantity <= item.alertLevel).map((item) => {
      const targetQuantity = item.alertLevel * 2;
      const preferred = preferredCatalogItems.find((catalogItem) => catalogItem.productId === item.productId && catalogItem.variantId === item.variantId)
        ?? (item.variantId ? preferredCatalogItems.find((catalogItem) => catalogItem.productId === item.productId && catalogItem.variantId === null) : undefined);
      return { ...item, targetQuantity, suggestedQuantity: Math.max(1, targetQuantity - item.quantity), preferredSupplier: preferred ? { ...preferred.supplier, lastCost: preferred.lastCost } : null };
    });
    return { branch, items: rows.sort((left, right) => left.quantity - right.quantity || left.product.localeCompare(right.product)) };
  }
  async activity(businessId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, businessId }, select: { id: true } });
    if (!branch) throw new NotFoundException('Branch not found.');
    const [productMovements, variantMovements] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { inventoryItem: { branchId } },
        include: { inventoryItem: { include: { product: { select: { id: true, name: true, sku: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.productVariantStockMovement.findMany({
        where: { inventory: { branchId, variant: { product: { businessId } } } },
        include: { inventory: { include: { variant: { include: { product: { select: { id: true, name: true, sku: true } } } } } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return [
      ...productMovements.map((movement) => ({
        id: `product-${movement.id}`,
        createdAt: movement.createdAt,
        quantityChange: movement.quantityChange,
        reason: movement.reason,
        product: movement.inventoryItem.product,
        variant: null,
      })),
      ...variantMovements.map((movement) => ({
        id: `variant-${movement.id}`,
        createdAt: movement.createdAt,
        quantityChange: movement.quantityChange,
        reason: movement.reason,
        product: movement.inventory.variant.product,
        variant: { id: movement.inventory.variant.id, name: movement.inventory.variant.name, sku: movement.inventory.variant.sku },
      })),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 50);
  }
  async transfer(businessId: string, actorId: string, sourceBranchId: string, input: { destinationBranchId: string; productId: string; variantId?: string; quantity: number; note?: string }) {
    if (sourceBranchId === input.destinationBranchId) throw new BadRequestException('Choose a different destination branch.');
    const [sourceBranch, destinationBranch, product] = await Promise.all([
      this.prisma.branch.findFirst({ where: { id: sourceBranchId, businessId } }),
      this.prisma.branch.findFirst({ where: { id: input.destinationBranchId, businessId } }),
      this.prisma.product.findFirst({ where: { id: input.productId, businessId } }),
    ]);
    if (!sourceBranch || !destinationBranch || !product) throw new NotFoundException('Branch or product not found.');
    if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new BadRequestException('Transfer quantity must be a whole number greater than zero.');
    if (input.variantId) {
      const variant = await this.prisma.productVariant.findFirst({ where: { id: input.variantId, productId: input.productId } });
      if (!variant) throw new NotFoundException('Variant not found for this product.');
      return this.prisma.$transaction(async (tx) => {
        const source = await tx.productVariantInventory.findUnique({ where: { branchId_variantId: { branchId: sourceBranchId, variantId: variant.id } } });
        if (!source || source.quantity < input.quantity) throw new BadRequestException(`${product.name} — ${variant.name}: only ${source?.quantity ?? 0} available at ${sourceBranch.name}.`);
        await tx.productVariantInventory.update({ where: { id: source.id }, data: { quantity: { decrement: input.quantity } } });
        const destination = await tx.productVariantInventory.upsert({ where: { branchId_variantId: { branchId: input.destinationBranchId, variantId: variant.id } }, create: { branchId: input.destinationBranchId, variantId: variant.id, quantity: input.quantity }, update: { quantity: { increment: input.quantity } } });
        const transfer = await tx.stockTransfer.create({ data: { businessId, sourceBranchId, destinationBranchId: input.destinationBranchId, productId: input.productId, variantId: variant.id, quantity: input.quantity, note: input.note?.trim() || null, createdById: actorId } });
        await tx.productVariantStockMovement.createMany({ data: [
          { productVariantInventoryId: source.id, quantityChange: -input.quantity, reason: `TRANSFER_OUT:${transfer.id}`, actorId },
          { productVariantInventoryId: destination.id, quantityChange: input.quantity, reason: `TRANSFER_IN:${transfer.id}`, actorId },
        ] });
        return transfer;
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.inventoryItem.findUnique({ where: { branchId_productId: { branchId: sourceBranchId, productId: input.productId } } });
      if (!source || source.quantity < input.quantity) throw new BadRequestException(`${product.name}: only ${source?.quantity ?? 0} available at ${sourceBranch.name}.`);
      const updatedSource = await tx.inventoryItem.update({ where: { id: source.id }, data: { quantity: { decrement: input.quantity } } });
      const destination = await tx.inventoryItem.upsert({ where: { branchId_productId: { branchId: input.destinationBranchId, productId: input.productId } }, create: { branchId: input.destinationBranchId, productId: input.productId, quantity: input.quantity }, update: { quantity: { increment: input.quantity } } });
      const transfer = await tx.stockTransfer.create({ data: { businessId, sourceBranchId, destinationBranchId: input.destinationBranchId, productId: input.productId, quantity: input.quantity, note: input.note?.trim() || null, createdById: actorId } });
      await tx.stockMovement.createMany({ data: [
        { inventoryItemId: updatedSource.id, quantityChange: -input.quantity, reason: `TRANSFER_OUT:${transfer.id}`, actorId },
        { inventoryItemId: destination.id, quantityChange: input.quantity, reason: `TRANSFER_IN:${transfer.id}`, actorId },
      ] });
      return transfer;
    });
  }
  history(businessId: string) { return this.prisma.stockTransfer.findMany({ where: { businessId }, include: { product: { select: { name: true, sku: true } }, variant: { select: { name: true, sku: true } }, sourceBranch: { select: { name: true } }, destinationBranch: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }); }
  async receive(businessId: string, actorId: string, branchId: string, input: { supplierId?: string; productId: string; variantId?: string; quantity: number; unitCost?: number; reference?: string; note?: string }) {
    const [branch, product, supplier] = await Promise.all([
      this.prisma.branch.findFirst({ where: { id: branchId, businessId } }),
      this.prisma.product.findFirst({ where: { id: input.productId, businessId } }),
      input.supplierId ? this.prisma.supplier.findFirst({ where: { id: input.supplierId, businessId, isActive: true } }) : Promise.resolve(null),
    ]);
    if (!branch || !product || (input.supplierId && !supplier)) throw new NotFoundException('Branch, product, or supplier not found.');
    if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new BadRequestException('Received quantity must be a whole number greater than zero.');
    if (input.unitCost !== undefined && input.unitCost < 0) throw new BadRequestException('Unit cost cannot be negative.');
    if (input.variantId) {
      const variant = await this.prisma.productVariant.findFirst({ where: { id: input.variantId, productId: input.productId } });
      if (!variant) throw new NotFoundException('Variant not found for this product.');
      return this.prisma.$transaction(async (tx) => {
        // Cost belongs to the sellable item across the business, while stock is
        // branch-specific. Calculate the weighted average before this delivery
        // changes the branch quantity.
        const onHand = await tx.productVariantInventory.aggregate({
          where: { variantId: variant.id },
          _sum: { quantity: true },
        });
        const inventory = await tx.productVariantInventory.upsert({ where: { branchId_variantId: { branchId, variantId: variant.id } }, create: { branchId, variantId: variant.id, quantity: input.quantity }, update: { quantity: { increment: input.quantity } } });
        const receipt = await tx.stockReceipt.create({ data: { businessId, branchId, supplierId: input.supplierId || null, productId: input.productId, variantId: variant.id, quantity: input.quantity, unitCost: input.unitCost ?? null, reference: input.reference?.trim() || null, note: input.note?.trim() || null, receivedById: actorId } });
        await tx.productVariantStockMovement.create({ data: { productVariantInventoryId: inventory.id, quantityChange: input.quantity, reason: `RECEIVED:${receipt.id}`, actorId } });
        if (input.unitCost !== undefined) {
          const existingQuantity = Math.max(0, onHand._sum.quantity ?? 0);
          const existingCost = variant.cost ?? input.unitCost;
          const weightedCost = Math.round(((existingQuantity * existingCost) + (input.quantity * input.unitCost)) / (existingQuantity + input.quantity));
          await tx.productVariant.update({ where: { id: variant.id }, data: { cost: weightedCost } });
          if (input.supplierId) {
            const catalogItem = await tx.supplierCatalogItem.findFirst({ where: { supplierId: input.supplierId, productId: input.productId, variantId: variant.id }, select: { id: true } });
            if (catalogItem) await tx.supplierCatalogItem.update({ where: { id: catalogItem.id }, data: { lastCost: input.unitCost } });
            else await tx.supplierCatalogItem.create({ data: { businessId, supplierId: input.supplierId, productId: input.productId, variantId: variant.id, lastCost: input.unitCost } });
          }
        }
        return receipt;
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const onHand = await tx.inventoryItem.aggregate({
        where: { productId: input.productId },
        _sum: { quantity: true },
      });
      const item = await tx.inventoryItem.upsert({ where: { branchId_productId: { branchId, productId: input.productId } }, create: { branchId, productId: input.productId, quantity: input.quantity }, update: { quantity: { increment: input.quantity } } });
      const receipt = await tx.stockReceipt.create({ data: { businessId, branchId, supplierId: input.supplierId || null, productId: input.productId, quantity: input.quantity, unitCost: input.unitCost ?? null, reference: input.reference?.trim() || null, note: input.note?.trim() || null, receivedById: actorId } });
      await tx.stockMovement.create({ data: { inventoryItemId: item.id, quantityChange: input.quantity, reason: `RECEIVED:${receipt.id}`, actorId } });
      if (input.unitCost !== undefined) {
        const existingQuantity = Math.max(0, onHand._sum.quantity ?? 0);
        const existingCost = product.cost ?? input.unitCost;
        const weightedCost = Math.round(((existingQuantity * existingCost) + (input.quantity * input.unitCost)) / (existingQuantity + input.quantity));
        await tx.product.update({ where: { id: product.id }, data: { cost: weightedCost } });
        if (input.supplierId) {
          const catalogItem = await tx.supplierCatalogItem.findFirst({ where: { supplierId: input.supplierId, productId: product.id, variantId: null }, select: { id: true } });
          if (catalogItem) await tx.supplierCatalogItem.update({ where: { id: catalogItem.id }, data: { lastCost: input.unitCost } });
          else await tx.supplierCatalogItem.create({ data: { businessId, supplierId: input.supplierId, productId: product.id, lastCost: input.unitCost } });
        }
      }
      return receipt;
    });
  }
  receipts(businessId: string) { return this.prisma.stockReceipt.findMany({ where: { businessId }, include: { branch: { select: { name: true } }, supplier: { select: { name: true } }, product: { select: { name: true, sku: true } }, variant: { select: { name: true, sku: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }); }
}
