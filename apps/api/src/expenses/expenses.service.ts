import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  list(businessId: string, branchId?: string) {
    return this.prisma.businessExpense.findMany({
      where: { businessId, ...(branchId ? { branchId } : {}) },
      include: { branch: { select: { name: true } } },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async create(
    businessId: string,
    branchId: string,
    actorId: string,
    input: {
      category: string;
      amount: number;
      paymentMethod: string;
      note?: string;
      expenseDate?: string;
    },
  ) {
    const category = input.category.trim();
    if (!category)
      throw new BadRequestException('Choose or enter an expense category.');
    const expenseDate = input.expenseDate
      ? new Date(input.expenseDate)
      : new Date();
    if (Number.isNaN(expenseDate.getTime()))
      throw new BadRequestException('Enter a valid expense date.');
    return this.prisma.$transaction(async (tx) => {
      const note = input.note?.trim() || null;
      let cashShiftId: string | null = null;
      if (input.paymentMethod === 'CASH') {
        const activeShift = await tx.cashShift.findFirst({
          where: { businessId, branchId, cashierId: actorId, closedAt: null },
          select: { id: true },
        });
        if (!activeShift)
          throw new BadRequestException(
            'Open your cash shift before recording a cash expense.',
          );
        cashShiftId = activeShift.id;
      }
      const expense = await tx.businessExpense.create({
        data: {
          businessId,
          branchId,
          category,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          note,
          expenseDate,
          recordedById: actorId,
        },
        include: { branch: { select: { name: true } } },
      });
      if (cashShiftId) {
        await tx.cashMovement.create({
          data: {
            cashShiftId,
            amount: -input.amount,
            reason: `Expense · ${category}${note ? ` · ${note}` : ''}`,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          businessId,
          actorId,
          action: 'BUSINESS_EXPENSE_RECORDED',
          entityType: 'BusinessExpense',
          entityId: expense.id,
          metadata: {
            category,
            amount: input.amount,
            paymentMethod: input.paymentMethod,
            cashShiftId,
          },
        },
      });
      return { ...expense, cashShiftId };
    });
  }
}
