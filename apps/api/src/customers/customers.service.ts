import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}
  async list(businessId: string, includeInactive = false) {
    const customers = await this.prisma.customer.findMany({
      where: { businessId, ...(includeInactive ? {} : { isActive: true }) },
      include: { sales: { where: { refundedAt: null }, select: { total: true, createdAt: true } } },
      orderBy: { name: 'asc' },
    });
    return customers.map(({ sales, ...customer }) => ({
      ...customer,
      saleCount: sales.length,
      totalSpent: sales.reduce((sum, sale) => sum + sale.total, 0),
      lastPurchaseAt: sales.reduce<Date | null>((latest, sale) => !latest || sale.createdAt > latest ? sale.createdAt : latest, null),
    }));
  }
  async create(businessId: string, input: { name: string; phone?: string; email?: string; note?: string }) {
    try {
      return await this.prisma.customer.create({ data: { businessId, name: input.name, phone: input.phone || null, email: input.email || null, note: input.note || null } });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('A customer already uses this phone number.');
      throw error;
    }
  }
  async update(businessId: string, customerId: string, input: { name?: string; phone?: string; email?: string; note?: string; isActive?: boolean }) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundException('Customer not found.');
    try {
      return await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
          ...(input.email !== undefined ? { email: input.email.trim() || null } : {}),
          ...(input.note !== undefined ? { note: input.note.trim() || null } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('A customer already uses this phone number.');
      throw error;
    }
  }
  async remove(businessId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, businessId }, select: { id: true, _count: { select: { sales: true } } } });
    if (!customer) throw new NotFoundException('Customer not found.');
    if (customer._count.sales) throw new ConflictException('This customer has purchase history and cannot be deleted. Archive them instead.');
    await this.prisma.customer.delete({ where: { id: customer.id } });
    return { deleted: true };
  }
}
