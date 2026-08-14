import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class ShiftsService { constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async open(businessId: string, cashierId: string, branchId: string, openingCash: number) { const branch = await this.prisma.branch.findFirst({ where: { id: branchId, businessId } }); if (!branch) throw new NotFoundException('Branch not found.'); const active = await this.prisma.cashShift.findFirst({ where: { cashierId, closedAt: null } }); if (active) throw new BadRequestException('You already have an open shift.'); const shift = await this.prisma.cashShift.create({ data: { businessId, branchId, cashierId, openingCash } }); await this.prisma.auditLog.create({ data: { businessId, actorId: cashierId, action: 'SHIFT_OPENED', entityType: 'CashShift', entityId: shift.id, metadata: { openingCash } } }); return shift; }
  async addMovement(businessId: string, cashierId: string, role: string, type: 'CASH_IN' | 'CASH_OUT', amount: number, reason: string, managerApprovalToken?: string) {
    const shift = await this.prisma.cashShift.findFirst({ where: { businessId, cashierId, closedAt: null } });
    if (!shift) throw new NotFoundException('No open shift found.');
    let approvedBy: string | null = null;
    if (type === 'CASH_OUT' && role === 'CASHIER') {
      if (!managerApprovalToken) throw new ForbiddenException('A manager PIN approval is required before cash can be removed.');
      try {
        const approval = await this.jwt.verifyAsync<{ purpose: string; action: string; businessId: string; branchId: string | null; cashierId: string; approvedBy: string }>(managerApprovalToken);
        if (approval.purpose !== 'MANAGER_APPROVAL' || approval.action !== 'CASH_OUT' || approval.businessId !== businessId || approval.branchId !== shift.branchId || approval.cashierId !== cashierId) throw new Error('Approval does not match this cash-out.');
        approvedBy = approval.approvedBy;
      } catch { throw new ForbiddenException('Manager approval is invalid or expired. Ask the manager to approve this cash-out again.'); }
    }
    const signedAmount = type === 'CASH_IN' ? amount : -amount;
    const movement = await this.prisma.cashMovement.create({ data: { cashShiftId: shift.id, amount: signedAmount, reason } });
    await this.prisma.auditLog.create({ data: { businessId, actorId: approvedBy ?? cashierId, action: type === 'CASH_IN' ? 'CASH_IN_RECORDED' : 'CASH_OUT_RECORDED', entityType: 'CashMovement', entityId: movement.id, metadata: { cashierId, branchId: shift.branchId, amount, reason, approvedBy } } });
    return movement;
  }
  async close(businessId: string, cashierId: string, closingCash: number, varianceReason?: string) {
    const shift = await this.prisma.cashShift.findFirst({ where: { businessId, cashierId, closedAt: null } });
    if (!shift) throw new NotFoundException('No open shift found.');

    const cashSales = await this.prisma.sale.aggregate({
      where: { cashShiftId: shift.id, paymentMethod: 'CASH', refundedAt: null },
      _sum: { total: true },
    });
    const cashSalesTotal = cashSales._sum.total ?? 0;
    const movements = await this.prisma.cashMovement.aggregate({ where: { cashShiftId: shift.id }, _sum: { amount: true } });
    const movementTotal = movements._sum.amount ?? 0;
    const expectedCash = shift.openingCash + cashSalesTotal + movementTotal;
    const reason = varianceReason?.trim() ?? '';
    const invalidReason =
      reason.length < 3 ||
      reason.toLowerCase() === 'enter a reason for the cash variance.';
    if (closingCash !== expectedCash && invalidReason)
      throw new BadRequestException('Enter a real reason for the cash variance, such as "Wrong change given".');
    const savedShift = await this.prisma.cashShift.update({ where: { id: shift.id }, data: { closingCash, varianceReason: closingCash !== expectedCash ? reason : null, closedAt: new Date() } });

    await this.prisma.auditLog.create({ data: { businessId, actorId: cashierId, action: 'SHIFT_CLOSED', entityType: 'CashShift', entityId: shift.id, metadata: { expectedCash, closingCash, difference: closingCash - expectedCash, varianceReason: savedShift.varianceReason } } });
    return { shift: savedShift, cashSalesTotal, movementTotal, expectedCash, difference: closingCash - expectedCash };
  }
  async current(businessId: string, cashierId: string) {
    const shift = await this.prisma.cashShift.findFirst({
      where: { businessId, cashierId, closedAt: null },
      include: { branch: { select: { name: true } }, movements: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!shift) return null;
    const [cashSales, movements] = await Promise.all([this.prisma.sale.aggregate({ where: { cashShiftId: shift.id, paymentMethod: 'CASH', refundedAt: null }, _sum: { total: true } }), this.prisma.cashMovement.aggregate({ where: { cashShiftId: shift.id }, _sum: { amount: true } })]);
    return { ...shift, expectedCash: shift.openingCash + (cashSales._sum.total ?? 0) + (movements._sum.amount ?? 0) };
  }
  async history(businessId: string, cashierId: string, requestedPage = 1, search = '') {
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
    const pageSize = 20;
    const where = { businessId, cashierId, closedAt: { not: null }, ...(search.trim() ? { OR: [{ varianceReason: { contains: search.trim(), mode: 'insensitive' as const } }, { branch: { name: { contains: search.trim(), mode: 'insensitive' as const } } }] } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cashShift.findMany({
      where,
      include: { branch: { select: { name: true } }, movements: true },
      orderBy: { closedAt: 'desc' },
      skip: (page - 1) * pageSize, take: pageSize,
    }), this.prisma.cashShift.count({ where })]);
    return { items, total, page, pageSize };
  }
}
