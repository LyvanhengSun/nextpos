import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateBusinessDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: { name: input.name, code: input.code, currency: input.currency },
        });
        const branch = await tx.branch.create({
          data: { businessId: business.id, name: input.branchName, code: input.branchCode },
        });
        const owner = await tx.user.create({
          data: {
            businessId: business.id,
            branchId: branch.id,
            email: input.ownerEmail.toLowerCase(),
            firstName: input.ownerFirstName,
            lastName: input.ownerLastName,
            role: 'OWNER',
          },
        });
        await tx.auditLog.create({
          data: {
            businessId: business.id,
            actorId: owner.id,
            action: 'BUSINESS_CREATED',
            entityType: 'Business',
            entityId: business.id,
          },
        });
        return { business, branch, owner };
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Business code or owner email already exists.');
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.business.findMany({
      include: { branches: true, _count: { select: { users: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listBranches(businessId: string) {
    return this.prisma.branch.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        createdAt: true,
        _count: { select: { users: true, inventory: true, sales: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  settings(businessId: string) {
    return this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        name: true,
        currency: true,
        taxRateBasisPoints: true,
        defaultInventoryAlertLevel: true,
        address: true,
        phone: true,
        receiptPrefix: true,
        receiptFooter: true,
      },
    });
  }

  async updateSettings(
    businessId: string,
    actorId: string,
    input: {
      taxRateBasisPoints?: number;
      defaultInventoryAlertLevel?: number;
      address?: string;
      phone?: string;
      receiptPrefix?: string;
      receiptFooter?: string;
    },
  ) {
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(input.taxRateBasisPoints !== undefined
          ? { taxRateBasisPoints: input.taxRateBasisPoints }
          : {}),
        ...(input.defaultInventoryAlertLevel !== undefined
          ? { defaultInventoryAlertLevel: input.defaultInventoryAlertLevel }
          : {}),
        ...(input.address !== undefined
          ? { address: input.address.trim() || null }
          : {}),
        ...(input.phone !== undefined
          ? { phone: input.phone.trim() || null }
          : {}),
        ...(input.receiptPrefix !== undefined
          ? { receiptPrefix: input.receiptPrefix.trim().toUpperCase() || 'R' }
          : {}),
        ...(input.receiptFooter !== undefined
          ? { receiptFooter: input.receiptFooter.trim() || null }
          : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'BUSINESS_SETTINGS_UPDATED',
        entityType: 'Business',
        entityId: businessId,
      },
    });
    return business;
  }

  async createBranch(businessId: string, input: { name: string; code: string; address?: string }, actorId: string) {
    try {
      const branch = await this.prisma.branch.create({
        data: {
          businessId,
          name: input.name.trim(),
          code: input.code.trim().toUpperCase(),
          address: input.address?.trim() || null,
        },
      });
      await this.prisma.auditLog.create({
        data: { businessId, actorId, action: 'BRANCH_CREATED', entityType: 'Branch', entityId: branch.id },
      });
      return branch;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) throw new ConflictException('A branch with this code already exists.');
      throw error;
    }
  }

  async updateBranch(businessId: string, branchId: string, input: { name?: string; code?: string; address?: string }, actorId: string) {
    const existing = await this.prisma.branch.findFirst({ where: { id: branchId, businessId } });
    if (!existing) throw new NotFoundException('Branch not found.');
    let branch;
    try {
      branch = await this.prisma.branch.update({
        where: { id: branchId },
        data: { ...(input.name ? { name: input.name.trim() } : {}), ...(input.code ? { code: input.code.trim().toUpperCase() } : {}), ...(input.address !== undefined ? { address: input.address.trim() || null } : {}) },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) throw new ConflictException('A branch with this code already exists.');
      throw error;
    }
    await this.prisma.auditLog.create({
      data: { businessId, actorId, action: 'BRANCH_UPDATED', entityType: 'Branch', entityId: branch.id },
    });
    return branch;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
