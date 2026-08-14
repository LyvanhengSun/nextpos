import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async daily(businessId: string, branchId?: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const saleWhere = {
      businessId,
      ...(branchId ? { branchId } : {}),
      refundedAt: null,
      createdAt: { gte: start, lt: end },
    };

    const expenseWhere = {
      businessId,
      ...(branchId ? { branchId } : {}),
      expenseDate: { gte: start, lt: end },
    };
    const [sales, paymentGroups, shifts, expenses, refunds] = await Promise.all(
      [
        this.prisma.sale.aggregate({
          where: saleWhere,
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.sale.groupBy({
          where: saleWhere,
          by: ['paymentMethod'],
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.cashShift.findMany({
          where: {
            businessId,
            ...(branchId ? { branchId } : {}),
            closedAt: { gte: start, lt: end },
          },
          select: {
            id: true,
            branchId: true,
            cashierId: true,
            openingCash: true,
            closingCash: true,
            openedAt: true,
            closedAt: true,
            varianceReason: true,
            cashier: { select: { firstName: true, lastName: true } },
          },
          orderBy: { closedAt: 'desc' },
        }),
        this.prisma.businessExpense.aggregate({
          where: expenseWhere,
          _sum: { amount: true },
          _count: true,
        }),
        this.prisma.sale.aggregate({
          where: {
            businessId,
            ...(branchId ? { branchId } : {}),
            refundedAt: { gte: start, lt: end },
          },
          _sum: { total: true },
          _count: true,
        }),
      ],
    );

    const closedShifts = await Promise.all(
      shifts.map(async (shift) => {
        const [cashSales, movements] = await Promise.all([
          this.prisma.sale.aggregate({
            where: {
              cashShiftId: shift.id,
              paymentMethod: 'CASH',
              refundedAt: null,
            },
            _sum: { total: true },
          }),
          this.prisma.cashMovement.aggregate({
            where: { cashShiftId: shift.id },
            _sum: { amount: true },
          }),
        ]);
        const expectedCash =
          shift.openingCash +
          (cashSales._sum.total ?? 0) +
          (movements._sum.amount ?? 0);
        const closingCash = shift.closingCash ?? 0;
        return {
          id: shift.id,
          cashier: `${shift.cashier.firstName} ${shift.cashier.lastName}`,
          openingCash: shift.openingCash,
          closingCash,
          expectedCash,
          difference: closingCash - expectedCash,
          varianceReason: shift.varianceReason,
          closedAt: shift.closedAt,
        };
      }),
    );

    return {
      date: start.toISOString(),
      salesTotal: sales._sum.total ?? 0,
      transactionCount: sales._count,
      expenseTotal: expenses._sum.amount ?? 0,
      expenseCount: expenses._count,
      refundTotal: refunds._sum.total ?? 0,
      refundCount: refunds._count,
      netSalesAfterExpenses:
        (sales._sum.total ?? 0) - (expenses._sum.amount ?? 0),
      payments: paymentGroups.map((group) => ({
        method: group.paymentMethod,
        total: group._sum.total ?? 0,
        count: group._count,
      })),
      closedShifts,
    };
  }

  async overview(businessId: string, branchId?: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const trendStart = new Date(start);
    trendStart.setDate(trendStart.getDate() - 6);
    const salesWhere = {
      businessId,
      ...(branchId ? { branchId } : {}),
      refundedAt: null,
      createdAt: { gte: start, lt: end },
    };
    const [
      sales,
      paymentGroups,
      weeklySales,
      inventory,
      openShifts,
      recentSales,
      users,
      overduePurchaseOrders,
      upcomingPurchaseOrders,
      overdueSupplierInvoices,
      pendingPurchaseOrderApprovals,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: salesWhere,
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.sale.groupBy({
        where: salesWhere,
        by: ['paymentMethod'],
        _sum: { total: true },
      }),
      this.prisma.sale.findMany({
        where: {
          businessId,
          ...(branchId ? { branchId } : {}),
          refundedAt: null,
          createdAt: { gte: trendStart, lt: end },
        },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.inventoryItem.findMany({
        where: branchId ? { branchId } : { branch: { businessId } },
        include: { product: { select: { name: true, reorderLevel: true } } },
      }),
      this.prisma.cashShift.findMany({
        where: {
          businessId,
          ...(branchId ? { branchId } : {}),
          closedAt: null,
        },
        include: {
          cashier: { select: { firstName: true, lastName: true } },
          branch: { select: { name: true } },
        },
        orderBy: { openedAt: 'desc' },
      }),
      this.prisma.sale.findMany({
        where: {
          businessId,
          ...(branchId ? { branchId } : {}),
          refundedAt: null,
        },
        include: { branch: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.user.findMany({
        where: { businessId },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          businessId,
          ...(branchId ? { branchId } : {}),
          status: 'ORDERED',
          OR: [
            { confirmedDeliveryDate: { lt: start } },
            {
              confirmedDeliveryDate: null,
              expectedDeliveryDate: { lt: start },
            },
          ],
        },
        select: {
          id: true,
          reference: true,
          expectedDeliveryDate: true,
          confirmedDeliveryDate: true,
          supplier: { select: { name: true } },
        },
        orderBy: { expectedDeliveryDate: 'asc' },
        take: 5,
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          businessId,
          ...(branchId ? { branchId } : {}),
          status: 'ORDERED',
          OR: [
            {
              confirmedDeliveryDate: {
                gte: start,
                lte: new Date(end.getTime() + 6 * 86_400_000),
              },
            },
            {
              confirmedDeliveryDate: null,
              expectedDeliveryDate: {
                gte: start,
                lte: new Date(end.getTime() + 6 * 86_400_000),
              },
            },
          ],
        },
        select: {
          id: true,
          reference: true,
          expectedDeliveryDate: true,
          confirmedDeliveryDate: true,
          supplier: { select: { name: true } },
        },
        orderBy: { expectedDeliveryDate: 'asc' },
        take: 5,
      }),
      this.prisma.supplierInvoice.findMany({
        where: {
          businessId,
          ...(branchId ? { branchId } : {}),
          dueDate: { lt: start },
          status: { not: 'PAID' },
        },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          dueDate: true,
          supplier: { select: { name: true } },
          payments: { select: { amount: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          businessId,
          ...(branchId ? { branchId } : {}),
          status: 'PENDING_APPROVAL',
        },
        select: {
          id: true,
          reference: true,
          createdById: true,
          submittedAt: true,
          supplier: { select: { name: true } },
          items: { select: { quantityOrdered: true, unitCost: true } },
        },
        orderBy: { submittedAt: 'asc' },
        take: 10,
      }),
    ]);
    const userNames = new Map(
      users.map((user) => [user.id, `${user.firstName} ${user.lastName}`]),
    );
    const localDateKey = (date: Date) =>
      [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-');
    const salesByDay = new Map<
      string,
      { revenue: number; transactions: number }
    >();
    weeklySales.forEach((sale) => {
      const key = localDateKey(sale.createdAt);
      const current = salesByDay.get(key) ?? {
        revenue: 0,
        transactions: 0,
      };
      current.revenue += sale.total;
      current.transactions += 1;
      salesByDay.set(key, current);
    });
    const salesTrend = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(trendStart);
      day.setDate(trendStart.getDate() + index);
      const date = localDateKey(day);
      return {
        date,
        revenue: salesByDay.get(date)?.revenue ?? 0,
        transactions: salesByDay.get(date)?.transactions ?? 0,
      };
    });
    return {
      date: start.toISOString(),
      salesTotal: sales._sum.total ?? 0,
      transactionCount: sales._count,
      salesTrend,
      payments: paymentGroups.map((group) => ({
        method: group.paymentMethod,
        total: group._sum.total ?? 0,
      })),
      lowStock: inventory
        .filter((item) => item.quantity <= item.product.reorderLevel)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 8)
        .map((item) => ({
          product: item.product.name,
          quantity: item.quantity,
          reorderLevel: item.product.reorderLevel,
        })),
      openShifts: openShifts.map((shift) => ({
        id: shift.id,
        cashier: `${shift.cashier.firstName} ${shift.cashier.lastName}`,
        branch: shift.branch.name,
        openingCash: shift.openingCash,
        openedAt: shift.openedAt,
      })),
      recentSales: recentSales.map((sale) => ({
        id: sale.id,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        createdAt: sale.createdAt,
        branch: sale.branch.name,
        cashier: userNames.get(sale.cashierId) ?? 'Unknown cashier',
      })),
      procurementAlerts: {
        pendingPurchaseOrderApprovals: pendingPurchaseOrderApprovals.map(
          (order) => ({
            id: order.id,
            reference: order.reference,
            supplier: order.supplier.name,
            submittedAt: order.submittedAt,
            submittedBy: userNames.get(order.createdById) ?? 'Unknown user',
            total: order.items.reduce(
              (sum, item) => sum + item.quantityOrdered * (item.unitCost ?? 0),
              0,
            ),
          }),
        ),
        overduePurchaseOrders: overduePurchaseOrders.map((order) => ({
          id: order.id,
          reference: order.reference,
          supplier: order.supplier.name,
          expectedDeliveryDate:
            order.confirmedDeliveryDate ?? order.expectedDeliveryDate,
        })),
        upcomingPurchaseOrders: upcomingPurchaseOrders.map((order) => ({
          id: order.id,
          reference: order.reference,
          supplier: order.supplier.name,
          expectedDeliveryDate:
            order.confirmedDeliveryDate ?? order.expectedDeliveryDate,
        })),
        overdueSupplierInvoices: overdueSupplierInvoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          supplier: invoice.supplier.name,
          dueDate: invoice.dueDate,
          balance: Math.max(
            0,
            invoice.total -
              invoice.payments.reduce(
                (sum, payment) => sum + payment.amount,
                0,
              ),
          ),
        })),
      },
    };
  }

  async range(
    businessId: string,
    branchId: string | undefined,
    fromInput?: string,
    toInput?: string,
  ) {
    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setHours(0, 0, 0, 0);
    const start = fromInput ? new Date(`${fromInput}T00:00:00`) : defaultStart;
    const end = toInput
      ? new Date(`${toInput}T00:00:00`)
      : new Date(defaultStart);
    end.setDate(end.getDate() + 1);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    )
      throw new BadRequestException('Choose a valid report date range.');
    const days = (end.getTime() - start.getTime()) / 86_400_000;
    if (days > 366)
      throw new BadRequestException('Choose a range of 366 days or less.');
    const saleWhere = {
      businessId,
      ...(branchId ? { branchId } : {}),
      refundedAt: null,
      createdAt: { gte: start, lt: end },
    };
    const expenseWhere = {
      businessId,
      ...(branchId ? { branchId } : {}),
      expenseDate: { gte: start, lt: end },
    };
    const [sales, payments, expenses, expenseCategories] = await Promise.all([
      this.prisma.sale.findMany({
        where: saleWhere,
        select: {
          total: true,
          paymentMethod: true,
          cashierId: true,
          items: {
            select: {
              quantity: true,
              lineTotal: true,
              unitCost: true,
              product: { select: { name: true } },
            },
          },
        },
        take: 5000,
      }),
      this.prisma.sale.groupBy({
        where: saleWhere,
        by: ['paymentMethod'],
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.businessExpense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.businessExpense.groupBy({
        where: expenseWhere,
        by: ['category'],
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
    ]);
    const userIds = [...new Set(sales.map((sale) => sale.cashierId))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { businessId, id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const names = new Map(
      users.map((user) => [user.id, `${user.firstName} ${user.lastName}`]),
    );
    const cashierTotals = new Map<
      string,
      { name: string; total: number; count: number }
    >();
    const productTotals = new Map<
      string,
      { name: string; quantity: number; total: number }
    >();
    for (const sale of sales) {
      const current = cashierTotals.get(sale.cashierId) ?? {
        name: names.get(sale.cashierId) ?? 'Unknown cashier',
        total: 0,
        count: 0,
      };
      current.total += sale.total;
      current.count += 1;
      cashierTotals.set(sale.cashierId, current);
      for (const item of sale.items) {
        const product = productTotals.get(item.product.name) ?? {
          name: item.product.name,
          quantity: 0,
          total: 0,
        };
        product.quantity += item.quantity;
        product.total += item.lineTotal;
        productTotals.set(item.product.name, product);
      }
    }
    const salesTotal = sales.reduce((sum, sale) => sum + sale.total, 0);
    const costOfGoodsSold = sales.reduce(
      (sum, sale) =>
        sum +
        sale.items.reduce(
          (itemTotal, item) => itemTotal + (item.unitCost ?? 0) * item.quantity,
          0,
        ),
      0,
    );
    const expenseTotal = expenses._sum.amount ?? 0;
    const grossProfit = salesTotal - costOfGoodsSold;
    return {
      from: start.toISOString(),
      to: new Date(end.getTime() - 1).toISOString(),
      salesTotal,
      transactionCount: sales.length,
      costOfGoodsSold,
      grossProfit,
      expenseTotal,
      expenseCount: expenses._count,
      // Kept for existing clients; netProfit is the correct P&L value.
      netSalesAfterExpenses: salesTotal - expenseTotal,
      netProfit: grossProfit - expenseTotal,
      expenseCategories: expenseCategories.map((expense) => ({
        category: expense.category,
        total: expense._sum.amount ?? 0,
        count: expense._count,
      })),
      payments: payments.map((payment) => ({
        method: payment.paymentMethod,
        total: payment._sum.total ?? 0,
        count: payment._count,
      })),
      cashiers: [...cashierTotals.values()].sort((a, b) => b.total - a.total),
      topProducts: [...productTotals.values()]
        .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
        .slice(0, 10),
    };
  }
}
