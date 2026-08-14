import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

type CreateInput = {
  supplierId: string;
  reference?: string;
  note?: string;
  expectedDeliveryDate?: string;
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    unitCost?: number;
  }[];
};

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  list(businessId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { businessId },
      include: {
        branch: { select: { name: true } },
        supplier: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
            variant: { select: { name: true, sku: true } },
          },
        },
        approvedBy: { select: { firstName: true, lastName: true } },
        rejectedBy: { select: { firstName: true, lastName: true } },
        dispatchedBy: { select: { firstName: true, lastName: true } },
        changeRequests: {
          where: { status: 'PENDING' },
          select: {
            id: true,
            reason: true,
            createdAt: true,
            requestedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async create(
    businessId: string,
    branchId: string,
    actorId: string,
    input: CreateInput,
  ) {
    if (!input.items.length)
      throw new BadRequestException('Add at least one product.');
    if (
      new Set(
        input.items.map((item) => `${item.productId}:${item.variantId ?? ''}`),
      ).size !== input.items.length
    )
      throw new BadRequestException(
        'A product or exact variant can only be added once to an order.',
      );
    const [supplier, products] = await Promise.all([
      this.prisma.supplier.findFirst({
        where: { id: input.supplierId, businessId, isActive: true },
      }),
      this.prisma.product.findMany({
        where: {
          businessId,
          id: { in: input.items.map((item) => item.productId) },
        },
      }),
    ]);
    if (
      !supplier ||
      products.length !==
        new Set(input.items.map((item) => item.productId)).size
    )
      throw new NotFoundException('Supplier or product not found.');
    const variantIds = input.items.flatMap((item) =>
      item.variantId ? [item.variantId] : [],
    );
    const variants = variantIds.length
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: variantIds }, product: { businessId } },
        })
      : [];
    if (
      variants.length !== variantIds.length ||
      input.items.some(
        (item) =>
          item.variantId &&
          !variants.some(
            (variant) =>
              variant.id === item.variantId &&
              variant.productId === item.productId,
          ),
      )
    )
      throw new NotFoundException(
        'One or more variants do not belong to their selected product.',
      );
    const order = await this.prisma.purchaseOrder.create({
      data: {
        businessId,
        branchId,
        supplierId: supplier.id,
        createdById: actorId,
        reference: input.reference?.trim() || null,
        note: input.note?.trim() || null,
        expectedDeliveryDate: input.expectedDeliveryDate
          ? new Date(input.expectedDeliveryDate)
          : null,
        status: 'DRAFT',
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantityOrdered: item.quantity,
            unitCost: item.unitCost ?? null,
          })),
        },
      },
      include: {
        supplier: { select: { name: true } },
        branch: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
            variant: { select: { name: true, sku: true } },
          },
        },
        approvedBy: { select: { firstName: true, lastName: true } },
        rejectedBy: { select: { firstName: true, lastName: true } },
        dispatchedBy: { select: { firstName: true, lastName: true } },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'PURCHASE_ORDER_CREATED',
        entityType: 'PurchaseOrder',
        entityId: order.id,
      },
    });
    return order;
  }

  async receive(
    businessId: string,
    actorId: string,
    id: string,
    receivedLines: { purchaseOrderItemId: string; quantity: number }[],
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Purchase order not found.');
    if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status))
      throw new BadRequestException(
        'Only approved purchase orders can be received.',
      );
    if (order.status === 'RECEIVED')
      throw new BadRequestException(
        'This purchase order was already received.',
      );
    if (!receivedLines.length)
      throw new BadRequestException('Enter at least one received quantity.');
    if (
      new Set(receivedLines.map((line) => line.purchaseOrderItemId)).size !==
      receivedLines.length
    )
      throw new BadRequestException('Each order item can only appear once.');
    return this.prisma.$transaction(async (tx) => {
      for (const receivedLine of receivedLines) {
        const line = order.items.find(
          (item) => item.id === receivedLine.purchaseOrderItemId,
        );
        if (!line)
          throw new BadRequestException(
            'One received item is not part of this purchase order.',
          );
        const remaining = line.quantityOrdered - line.quantityReceived;
        if (receivedLine.quantity > remaining)
          throw new BadRequestException(
            `Only ${remaining} unit(s) remain for this product.`,
          );
        const onHand = line.variantId
          ? await tx.productVariantInventory.aggregate({
              where: { variantId: line.variantId },
              _sum: { quantity: true },
            })
          : await tx.inventoryItem.aggregate({
              where: { productId: line.productId },
              _sum: { quantity: true },
            });
        const inventory = line.variantId
          ? await tx.productVariantInventory.upsert({
              where: {
                branchId_variantId: {
                  branchId: order.branchId,
                  variantId: line.variantId,
                },
              },
              create: {
                branchId: order.branchId,
                variantId: line.variantId,
                quantity: receivedLine.quantity,
              },
              update: { quantity: { increment: receivedLine.quantity } },
            })
          : await tx.inventoryItem.upsert({
              where: {
                branchId_productId: {
                  branchId: order.branchId,
                  productId: line.productId,
                },
              },
              create: {
                branchId: order.branchId,
                productId: line.productId,
                quantity: receivedLine.quantity,
              },
              update: { quantity: { increment: receivedLine.quantity } },
            });
        const receipt = await tx.stockReceipt.create({
          data: {
            businessId,
            branchId: order.branchId,
            supplierId: order.supplierId,
            productId: line.productId,
            variantId: line.variantId,
            quantity: receivedLine.quantity,
            unitCost: line.unitCost,
            reference: order.reference,
            note: `Purchase order ${order.id}`,
            receivedById: actorId,
          },
        });
        if (line.variantId)
          await tx.productVariantStockMovement.create({
            data: {
              productVariantInventoryId: inventory.id,
              quantityChange: receivedLine.quantity,
              reason: `PURCHASE_ORDER_RECEIVED:${receipt.id}`,
              actorId,
            },
          });
        else
          await tx.stockMovement.create({
            data: {
              inventoryItemId: inventory.id,
              quantityChange: receivedLine.quantity,
              reason: `PURCHASE_ORDER_RECEIVED:${receipt.id}`,
              actorId,
            },
          });
        if (line.unitCost !== null) {
          const existingQuantity = Math.max(0, onHand._sum.quantity ?? 0);
          if (line.variantId) {
            const variant = await tx.productVariant.findUnique({
              where: { id: line.variantId },
              select: { cost: true },
            });
            const existingCost = variant?.cost ?? line.unitCost;
            const weightedCost = Math.round(
              (existingQuantity * existingCost +
                receivedLine.quantity * line.unitCost) /
                (existingQuantity + receivedLine.quantity),
            );
            await tx.productVariant.update({
              where: { id: line.variantId },
              data: { cost: weightedCost },
            });
          } else {
            const product = await tx.product.findUnique({
              where: { id: line.productId },
              select: { cost: true },
            });
            const existingCost = product?.cost ?? line.unitCost;
            const weightedCost = Math.round(
              (existingQuantity * existingCost +
                receivedLine.quantity * line.unitCost) /
                (existingQuantity + receivedLine.quantity),
            );
            await tx.product.update({
              where: { id: line.productId },
              data: { cost: weightedCost },
            });
          }
          const catalogItem = await tx.supplierCatalogItem.findFirst({
            where: {
              supplierId: order.supplierId,
              productId: line.productId,
              variantId: line.variantId ?? null,
            },
            select: { id: true },
          });
          if (catalogItem) {
            await tx.supplierCatalogItem.update({
              where: { id: catalogItem.id },
              data: { lastCost: line.unitCost },
            });
          } else {
            await tx.supplierCatalogItem.create({
              data: {
                businessId,
                supplierId: order.supplierId,
                productId: line.productId,
                variantId: line.variantId ?? null,
                lastCost: line.unitCost,
              },
            });
          }
        }
        await tx.purchaseOrderItem.update({
          where: { id: line.id },
          data: { quantityReceived: { increment: receivedLine.quantity } },
        });
      }
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: order.id },
      });
      const complete = updatedItems.every(
        (item) => item.quantityReceived >= item.quantityOrdered,
      );
      const received = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
          ...(complete ? { receivedAt: new Date() } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorId,
          action: complete
            ? 'PURCHASE_ORDER_RECEIVED'
            : 'PURCHASE_ORDER_PARTIALLY_RECEIVED',
          entityType: 'PurchaseOrder',
          entityId: order.id,
        },
      });
      return received;
    });
  }

  async cancel(businessId: string, actorId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
      include: { items: { select: { quantityReceived: true } } },
    });
    if (!order) throw new NotFoundException('Purchase order not found.');
    if (order.status === 'CANCELLED')
      throw new BadRequestException(
        'This purchase order is already cancelled.',
      );
    if (
      order.status === 'RECEIVED' ||
      order.items.some((item) => item.quantityReceived > 0)
    )
      throw new BadRequestException(
        'Only purchase orders with no received stock can be cancelled.',
      );
    const cancelled = await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'PURCHASE_ORDER_CANCELLED',
        entityType: 'PurchaseOrder',
        entityId: order.id,
      },
    });
    return cancelled;
  }

  async submitForApproval(businessId: string, actorId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
    });
    if (!order) throw new NotFoundException('Purchase order not found.');
    if (order.status !== 'DRAFT')
      throw new BadRequestException(
        'Only draft purchase orders can be submitted for approval.',
      );
    const submitted = await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: 'PENDING_APPROVAL',
        submittedAt: new Date(),
        rejectedAt: null,
        rejectedById: null,
        rejectionReason: null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'PURCHASE_ORDER_SUBMITTED_FOR_APPROVAL',
        entityType: 'PurchaseOrder',
        entityId: order.id,
      },
    });
    return submitted;
  }

  async approve(businessId: string, actorId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
    });
    if (!order) throw new NotFoundException('Purchase order not found.');
    if (order.status !== 'PENDING_APPROVAL')
      throw new BadRequestException(
        'Only submitted purchase orders can be approved.',
      );
    const approved = await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: 'ORDERED',
        approvedAt: new Date(),
        approvedById: actorId,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'PURCHASE_ORDER_APPROVED',
        entityType: 'PurchaseOrder',
        entityId: order.id,
      },
    });
    return approved;
  }

  async reject(
    businessId: string,
    actorId: string,
    id: string,
    reason: string,
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
    });
    if (!order) throw new NotFoundException('Purchase order not found.');
    if (order.status !== 'PENDING_APPROVAL')
      throw new BadRequestException(
        'Only submitted purchase orders can be rejected.',
      );
    const rejectionReason = reason.trim();
    if (!rejectionReason)
      throw new BadRequestException('Enter a reason for rejecting this order.');
    const rejected = await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: 'DRAFT',
        rejectedAt: new Date(),
        rejectedById: actorId,
        rejectionReason,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'PURCHASE_ORDER_REJECTED',
        entityType: 'PurchaseOrder',
        entityId: order.id,
        metadata: { reason: rejectionReason },
      },
    });
    return rejected;
  }

  async dispatch(businessId: string, actorId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
    });
    if (!order) throw new NotFoundException('Purchase order not found.');
    if (order.status !== 'ORDERED')
      throw new BadRequestException(
        'Only approved, unreceived purchase orders can be sent to a supplier.',
      );
    if (order.dispatchedAt)
      throw new BadRequestException(
        'This purchase order was already marked as sent to the supplier.',
      );
    const dispatched = await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { dispatchedAt: new Date(), dispatchedById: actorId },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'PURCHASE_ORDER_DISPATCHED',
        entityType: 'PurchaseOrder',
        entityId: order.id,
      },
    });
    return dispatched;
  }

  async confirmSupplier(
    businessId: string,
    actorId: string,
    id: string,
    input: { reference?: string; confirmedDeliveryDate?: string },
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
    });
    if (!order) throw new NotFoundException('Purchase order not found.');
    if (order.status !== 'ORDERED' || !order.dispatchedAt)
      throw new BadRequestException(
        'Only sent, unreceived purchase orders can be confirmed by a supplier.',
      );
    const confirmed = await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: {
        supplierConfirmedAt: new Date(),
        supplierConfirmationReference: input.reference?.trim() || null,
        ...(input.confirmedDeliveryDate !== undefined
          ? {
              confirmedDeliveryDate: input.confirmedDeliveryDate
                ? new Date(input.confirmedDeliveryDate)
                : null,
            }
          : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'PURCHASE_ORDER_SUPPLIER_CONFIRMED',
        entityType: 'PurchaseOrder',
        entityId: order.id,
        metadata: {
          reference: input.reference?.trim() || null,
          confirmedDeliveryDate: input.confirmedDeliveryDate || null,
        },
      },
    });
    return confirmed;
  }

  async requestChange(
    businessId: string,
    actorId: string,
    id: string,
    input: {
      reason: string;
      expectedDeliveryDate?: string;
      items: { id: string; quantity: number; unitCost?: number | null }[];
    },
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
      include: {
        items: { select: { id: true, quantityReceived: true } },
        changeRequests: { where: { status: 'PENDING' }, select: { id: true } },
      },
    });
    if (!order) throw new NotFoundException('Purchase order not found.');
    if (
      order.status !== 'ORDERED' ||
      !order.supplierConfirmedAt ||
      order.items.some((item) => item.quantityReceived > 0)
    )
      throw new BadRequestException(
        'Only confirmed purchase orders with no received stock can be changed.',
      );
    if (order.changeRequests.length)
      throw new BadRequestException(
        'This purchase order already has a pending change request.',
      );
    if (
      input.items.length !== order.items.length ||
      new Set(input.items.map((item) => item.id)).size !== input.items.length ||
      input.items.some(
        (item) => !order.items.some((orderItem) => orderItem.id === item.id),
      )
    )
      throw new BadRequestException(
        'A change request must include each existing order item once.',
      );
    const reason = input.reason.trim();
    if (!reason)
      throw new BadRequestException('Enter a reason for the requested change.');
    const request = await this.prisma.purchaseOrderChangeRequest.create({
      data: {
        businessId,
        purchaseOrderId: order.id,
        requestedById: actorId,
        reason,
        changes: {
          items: input.items,
          expectedDeliveryDate: input.expectedDeliveryDate ?? null,
        },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'PURCHASE_ORDER_CHANGE_REQUESTED',
        entityType: 'PurchaseOrder',
        entityId: order.id,
        metadata: { changeRequestId: request.id, reason },
      },
    });
    return request;
  }

  async approveChange(businessId: string, actorId: string, requestId: string) {
    const request = await this.prisma.purchaseOrderChangeRequest.findFirst({
      where: { id: requestId, businessId },
      include: {
        purchaseOrder: {
          include: { items: { select: { id: true, quantityReceived: true } } },
        },
      },
    });
    if (!request)
      throw new NotFoundException('Purchase order change request not found.');
    if (request.status !== 'PENDING')
      throw new BadRequestException(
        'This change request has already been reviewed.',
      );
    const order = request.purchaseOrder;
    if (
      order.status !== 'ORDERED' ||
      order.items.some((item) => item.quantityReceived > 0)
    )
      throw new BadRequestException(
        'This purchase order can no longer be changed.',
      );
    const changes = request.changes as unknown as {
      items: { id: string; quantity: number; unitCost?: number | null }[];
      expectedDeliveryDate?: string | null;
    };
    if (
      changes.items.length !== order.items.length ||
      changes.items.some(
        (item) => !order.items.some((orderItem) => orderItem.id === item.id),
      )
    )
      throw new BadRequestException(
        'The requested line changes are no longer valid.',
      );
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          expectedDeliveryDate: changes.expectedDeliveryDate
            ? new Date(changes.expectedDeliveryDate)
            : null,
          items: {
            update: changes.items.map((item) => ({
              where: { id: item.id },
              data: {
                quantityOrdered: item.quantity,
                ...(item.unitCost !== undefined
                  ? { unitCost: item.unitCost }
                  : {}),
              },
            })),
          },
        },
      });
      await tx.purchaseOrderChangeRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorId,
          action: 'PURCHASE_ORDER_CHANGE_APPROVED',
          entityType: 'PurchaseOrder',
          entityId: order.id,
          metadata: { changeRequestId: request.id },
        },
      });
      return updated;
    });
  }

  async update(
    businessId: string,
    actorId: string,
    id: string,
    input: {
      reference?: string;
      note?: string;
      expectedDeliveryDate?: string;
      items?: {
        id?: string;
        productId?: string;
        variantId?: string;
        quantity: number;
        unitCost?: number | null;
      }[];
    },
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantityReceived: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Purchase order not found.');
    if (order.status !== 'DRAFT')
      throw new BadRequestException(
        'Only draft purchase orders can be edited.',
      );
    if (input.items) {
      if (!input.items.length)
        throw new BadRequestException('Add at least one product.');
      const existingItems = input.items.filter((item) => item.id);
      const newItems = input.items.filter((item) => !item.id);
      if (
        new Set(existingItems.map((item) => item.id)).size !==
          existingItems.length ||
        existingItems.some(
          (item) => !order.items.some((orderItem) => orderItem.id === item.id),
        ) ||
        newItems.some((item) => !item.productId)
      )
        throw new BadRequestException(
          'One or more purchase order items are invalid.',
        );
      const targets = input.items.map((item) =>
        item.id
          ? order.items.find((orderItem) => orderItem.id === item.id)!
          : { productId: item.productId!, variantId: item.variantId ?? null },
      );
      if (
        new Set(
          targets.map((item) => `${item.productId}:${item.variantId ?? ''}`),
        ).size !== targets.length
      )
        throw new BadRequestException(
          'A product or exact variant can only appear once in an order.',
        );
      const newProductIds = newItems.map((item) => item.productId!);
      const products = newProductIds.length
        ? await this.prisma.product.findMany({
            where: { businessId, id: { in: newProductIds } },
            select: { id: true },
          })
        : [];
      const newVariantIds = newItems.flatMap((item) =>
        item.variantId ? [item.variantId] : [],
      );
      const variants = newVariantIds.length
        ? await this.prisma.productVariant.findMany({
            where: { id: { in: newVariantIds }, product: { businessId } },
            select: { id: true, productId: true },
          })
        : [];
      if (
        products.length !== new Set(newProductIds).size ||
        variants.length !== newVariantIds.length ||
        newItems.some(
          (item) =>
            item.variantId &&
            !variants.some(
              (variant) =>
                variant.id === item.variantId &&
                variant.productId === item.productId,
            ),
        )
      )
        throw new NotFoundException(
          'One or more added products or variants were not found.',
        );
    }
    return this.prisma.$transaction(async (tx) => {
      if (input.items) {
        const existingIds = input.items.flatMap((item) =>
          item.id ? [item.id] : [],
        );
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: order.id, id: { notIn: existingIds } },
        });
        await Promise.all(
          input.items.map((item) =>
            item.id
              ? tx.purchaseOrderItem.update({
                  where: { id: item.id },
                  data: {
                    quantityOrdered: item.quantity,
                    ...(item.unitCost !== undefined
                      ? { unitCost: item.unitCost }
                      : {}),
                  },
                })
              : tx.purchaseOrderItem.create({
                  data: {
                    purchaseOrderId: order.id,
                    productId: item.productId!,
                    variantId: item.variantId ?? null,
                    quantityOrdered: item.quantity,
                    unitCost: item.unitCost ?? null,
                  },
                }),
          ),
        );
      }
      const updated = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          ...(input.reference !== undefined
            ? { reference: input.reference.trim() || null }
            : {}),
          ...(input.note !== undefined
            ? { note: input.note.trim() || null }
            : {}),
          ...(input.expectedDeliveryDate !== undefined
            ? {
                expectedDeliveryDate: input.expectedDeliveryDate
                  ? new Date(input.expectedDeliveryDate)
                  : null,
              }
            : {}),
        },
        include: {
          branch: { select: { name: true } },
          supplier: { select: { name: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
              variant: { select: { name: true, sku: true } },
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorId,
          action: 'PURCHASE_ORDER_UPDATED',
          entityType: 'PurchaseOrder',
          entityId: order.id,
        },
      });
      return updated;
    });
  }
}
