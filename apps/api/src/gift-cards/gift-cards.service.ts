import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class GiftCardsService {
  constructor(private readonly prisma: PrismaService) {}
  list(businessId: string) { return this.prisma.giftCard.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } }); }
  async create(businessId: string, code: string, balance: number) {
    const cleanCode = code.trim().toUpperCase();
    const existing = await this.prisma.giftCard.findFirst({ where: { businessId, code: cleanCode } });
    if (existing) throw new ConflictException(`Gift card code “${cleanCode}” already exists.`);
    return this.prisma.giftCard.create({ data: { businessId, code: cleanCode, balance } });
  }
  async find(businessId: string, code: string) { const card = await this.prisma.giftCard.findFirst({ where: { businessId, code: code.trim().toUpperCase(), isActive: true } }); if (!card) throw new NotFoundException('Gift card not found.'); return card; }
}
