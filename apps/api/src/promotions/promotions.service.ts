import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

type Input = { name: string; type: string; value: number; minimumSpend?: number; productId?: string; categoryId?: string; buyQuantity?: number; rewardQuantity?: number; startsAt?: string; endsAt?: string };

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}
  list(businessId: string) { return this.prisma.promotion.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } }); }
  active(businessId: string) {
    const now = new Date();
    return this.prisma.promotion.findMany({ where: { businessId, isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, orderBy: { createdAt: 'desc' } });
  }
  create(businessId: string, input: Input) {
    return this.prisma.promotion.create({ data: { businessId, name: input.name.trim(), type: input.type, value: input.value, minimumSpend: input.minimumSpend ?? 0, productId: input.productId || null, categoryId: input.categoryId || null, buyQuantity: input.buyQuantity ?? 0, rewardQuantity: input.rewardQuantity ?? 0, startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null } });
  }
  async toggle(businessId: string, id: string) {
    const current = await this.prisma.promotion.findFirstOrThrow({ where: { id, businessId } });
    return this.prisma.promotion.update({ where: { id }, data: { isActive: !current.isActive } });
  }
}
