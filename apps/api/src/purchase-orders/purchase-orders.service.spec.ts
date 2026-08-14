import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';

describe('PurchaseOrdersService', () => {
  const businessId = 'business-1';
  const actorId = 'user-1';

  function createService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      purchaseOrder: { findFirst: jest.fn(), update: jest.fn() },
      purchaseOrderItem: {
        deleteMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      product: { findMany: jest.fn() },
      productVariant: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(),
      ...overrides,
    } as any;
    return { prisma, service: new PurchaseOrdersService(prisma) };
  }

  describe('cancel', () => {
    it('cancels an entirely unreceived order and records an audit event', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'ORDERED',
        items: [{ quantityReceived: 0 }],
      });
      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED',
      });

      await expect(
        service.cancel(businessId, actorId, 'po-1'),
      ).resolves.toEqual({ id: 'po-1', status: 'CANCELLED' });
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po-1' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PURCHASE_ORDER_CANCELLED',
            entityId: 'po-1',
          }),
        }),
      );
    });

    it('refuses cancellation after receiving has begun', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'PARTIALLY_RECEIVED',
        items: [{ quantityReceived: 1 }],
      });

      await expect(
        service.cancel(businessId, actorId, 'po-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
    });

    it('reports a missing order without updating anything', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.cancel(businessId, actorId, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('adds a new valid line and removes omitted lines while an order is a draft', async () => {
      const { prisma, service } = createService();
      let transactionClient: any;
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        items: [
          {
            id: 'old-line',
            productId: 'old-product',
            variantId: null,
            quantityReceived: 0,
          },
        ],
      });
      prisma.product.findMany.mockResolvedValue([{ id: 'new-product' }]);
      prisma.$transaction.mockImplementation(
        async (callback: (tx: any) => unknown) => {
          transactionClient = {
            purchaseOrderItem: {
              deleteMany: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
            purchaseOrder: {
              update: jest.fn().mockResolvedValue({ id: 'po-1' }),
            },
            auditLog: { create: jest.fn() },
          };
          return callback(transactionClient);
        },
      );

      await expect(
        service.update(businessId, actorId, 'po-1', {
          items: [{ productId: 'new-product', quantity: 3, unitCost: 275 }],
        }),
      ).resolves.toEqual({ id: 'po-1' });
      expect(
        transactionClient.purchaseOrderItem.deleteMany,
      ).toHaveBeenCalledWith({
        where: { purchaseOrderId: 'po-1', id: { notIn: [] } },
      });
      expect(transactionClient.purchaseOrderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'new-product',
            quantityOrdered: 3,
            unitCost: 275,
          }),
        }),
      );
    });

    it('refuses edits once any stock has been received', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'PARTIALLY_RECEIVED',
        items: [
          {
            id: 'line-1',
            productId: 'product-1',
            variantId: null,
            quantityReceived: 1,
          },
        ],
      });

      await expect(
        service.update(businessId, actorId, 'po-1', {
          items: [{ id: 'line-1', quantity: 2 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('approval', () => {
    it('submits a draft for approval and records an audit event', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
      });
      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'PENDING_APPROVAL',
      });

      await expect(
        service.submitForApproval(businessId, actorId, 'po-1'),
      ).resolves.toEqual({ id: 'po-1', status: 'PENDING_APPROVAL' });
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: expect.objectContaining({ status: 'PENDING_APPROVAL' }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PURCHASE_ORDER_SUBMITTED_FOR_APPROVAL',
          }),
        }),
      );
    });

    it('approves only submitted purchase orders', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'PENDING_APPROVAL',
      });
      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'ORDERED',
      });

      await expect(
        service.approve(businessId, actorId, 'po-1'),
      ).resolves.toEqual({ id: 'po-1', status: 'ORDERED' });
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ORDERED',
            approvedById: actorId,
          }),
        }),
      );
    });

    it('returns a submitted order to draft with its rejection reason', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'PENDING_APPROVAL',
      });
      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
      });

      await expect(
        service.reject(businessId, actorId, 'po-1', 'Please confirm the cost.'),
      ).resolves.toEqual({ id: 'po-1', status: 'DRAFT' });
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
            rejectedById: actorId,
            rejectionReason: 'Please confirm the cost.',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'PURCHASE_ORDER_REJECTED' }),
        }),
      );
    });
  });

  describe('dispatch', () => {
    it('marks an approved order as sent and records an audit event', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'ORDERED',
        dispatchedAt: null,
      });
      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        dispatchedAt: new Date(),
      });

      await expect(
        service.dispatch(businessId, actorId, 'po-1'),
      ).resolves.toEqual(expect.objectContaining({ id: 'po-1' }));
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dispatchedById: actorId }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PURCHASE_ORDER_DISPATCHED',
          }),
        }),
      );
    });

    it('records a supplier confirmation only after an order was sent', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'ORDERED',
        dispatchedAt: new Date(),
      });
      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        supplierConfirmedAt: new Date(),
      });

      await expect(
        service.confirmSupplier(businessId, actorId, 'po-1', {
          reference: 'SUP-123',
          confirmedDeliveryDate: '2026-08-01',
        }),
      ).resolves.toEqual(expect.objectContaining({ id: 'po-1' }));
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supplierConfirmationReference: 'SUP-123',
          }),
        }),
      );
    });
  });

  describe('change requests', () => {
    it('stages confirmed-order changes without updating the purchase order', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrderChangeRequest = {
        create: jest.fn().mockResolvedValue({ id: 'change-1' }),
      };
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'ORDERED',
        supplierConfirmedAt: new Date(),
        items: [{ id: 'line-1', quantityReceived: 0 }],
        changeRequests: [],
      });

      await expect(
        service.requestChange(businessId, actorId, 'po-1', {
          reason: 'Supplier confirmed a higher cost.',
          expectedDeliveryDate: '2026-08-03',
          items: [{ id: 'line-1', quantity: 3, unitCost: 325 }],
        }),
      ).resolves.toEqual({ id: 'change-1' });
      expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
      expect(prisma.purchaseOrderChangeRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseOrderId: 'po-1',
            reason: 'Supplier confirmed a higher cost.',
          }),
        }),
      );
    });
  });

  describe('receive', () => {
    it('updates the supplier catalog with the actual received cost', async () => {
      const { prisma, service } = createService();
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        businessId,
        branchId: 'branch-1',
        supplierId: 'supplier-1',
        reference: 'PO-1',
        status: 'ORDERED',
        items: [
          {
            id: 'line-1',
            productId: 'product-1',
            variantId: null,
            quantityOrdered: 4,
            quantityReceived: 0,
            unitCost: 300,
          },
        ],
      });
      let transactionClient: any;
      prisma.$transaction.mockImplementation(
        async (callback: (tx: any) => unknown) => {
          transactionClient = {
            inventoryItem: {
              aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 2 } }),
              upsert: jest.fn().mockResolvedValue({ id: 'inventory-1' }),
            },
            stockReceipt: {
              create: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
            },
            stockMovement: { create: jest.fn() },
            product: {
              findUnique: jest.fn().mockResolvedValue({ cost: 200 }),
              update: jest.fn(),
            },
            supplierCatalogItem: {
              findFirst: jest.fn().mockResolvedValue({ id: 'catalog-1' }),
              update: jest.fn(),
            },
            purchaseOrderItem: {
              update: jest.fn(),
              findMany: jest
                .fn()
                .mockResolvedValue([
                  { quantityOrdered: 4, quantityReceived: 2 },
                ]),
            },
            purchaseOrder: {
              update: jest.fn().mockResolvedValue({
                id: 'po-1',
                status: 'PARTIALLY_RECEIVED',
              }),
            },
            auditLog: { create: jest.fn() },
          };
          return callback(transactionClient);
        },
      );

      await service.receive(businessId, actorId, 'po-1', [
        { purchaseOrderItemId: 'line-1', quantity: 2 },
      ]);

      expect(transactionClient.supplierCatalogItem.update).toHaveBeenCalledWith(
        { where: { id: 'catalog-1' }, data: { lastCost: 300 } },
      );
    });
  });
});
