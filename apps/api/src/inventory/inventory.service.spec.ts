import { InventoryService } from './inventory.service';

describe('InventoryService supplier catalog synchronization', () => {
  function createService() {
    const prisma = {
      branch: { findFirst: jest.fn() },
      product: { findFirst: jest.fn() },
      supplier: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    } as any;
    return { prisma, service: new InventoryService(prisma) };
  }

  it('creates a supplier catalog cost from a direct product receipt', async () => {
    const { prisma, service } = createService();
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    prisma.product.findFirst.mockResolvedValue({ id: 'product-1', cost: 150 });
    prisma.supplier.findFirst.mockResolvedValue({ id: 'supplier-1' });
    let tx: any;
    prisma.$transaction.mockImplementation(
      async (callback: (client: any) => unknown) => {
        tx = {
          inventoryItem: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 4 } }),
            upsert: jest.fn().mockResolvedValue({ id: 'inventory-1' }),
          },
          stockReceipt: {
            create: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
          },
          stockMovement: { create: jest.fn() },
          product: { update: jest.fn() },
          supplierCatalogItem: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
        };
        return callback(tx);
      },
    );

    await service.receive('business-1', 'user-1', 'branch-1', {
      supplierId: 'supplier-1',
      productId: 'product-1',
      quantity: 2,
      unitCost: 250,
    });

    expect(tx.supplierCatalogItem.create).toHaveBeenCalledWith({
      data: {
        businessId: 'business-1',
        supplierId: 'supplier-1',
        productId: 'product-1',
        lastCost: 250,
      },
    });
  });

  it('does not touch the supplier catalog when a direct receipt has no supplier or cost', async () => {
    const { prisma, service } = createService();
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    prisma.product.findFirst.mockResolvedValue({ id: 'product-1', cost: null });
    let tx: any;
    prisma.$transaction.mockImplementation(
      async (callback: (client: any) => unknown) => {
        tx = {
          inventoryItem: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
            upsert: jest.fn().mockResolvedValue({ id: 'inventory-1' }),
          },
          stockReceipt: {
            create: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
          },
          stockMovement: { create: jest.fn() },
          product: { update: jest.fn() },
          supplierCatalogItem: { findFirst: jest.fn(), create: jest.fn() },
        };
        return callback(tx);
      },
    );

    await service.receive('business-1', 'user-1', 'branch-1', {
      productId: 'product-1',
      quantity: 2,
    });

    expect(tx.supplierCatalogItem.findFirst).not.toHaveBeenCalled();
    expect(tx.supplierCatalogItem.create).not.toHaveBeenCalled();
  });
});
