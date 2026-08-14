import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';

type CreateStaff = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  pin?: string;
  role: UserRole;
  branchId?: string;
};

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}
  async list(businessId: string) {
    const users = await this.prisma.user.findMany({
      where: { businessId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        pinHash: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ pinHash, ...user }) => ({
      ...user,
      hasPin: Boolean(pinHash),
    }));
  }
  async create(businessId: string, input: CreateStaff, actorId: string) {
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: input.branchId, businessId },
      });
      if (!branch) throw new NotFoundException('Branch not found.');
    }
    try {
      const user = await this.prisma.user.create({
        data: {
          businessId,
          branchId: input.branchId,
          email: input.email.toLowerCase(),
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          passwordHash: await hash(input.password, 12),
          pinHash: input.pin ? await hash(input.pin, 12) : undefined,
        },
      });
      await this.prisma.auditLog.create({
        data: {
          businessId,
          actorId,
          action: 'STAFF_CREATED',
          entityType: 'User',
          entityId: user.id,
        },
      });
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException('This email is already in use.');
      throw error;
    }
  }
  async setPin(
    businessId: string,
    userId: string,
    pin: string,
    actorId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId },
    });
    if (!user) throw new NotFoundException('Staff member not found.');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { pinHash: await hash(pin, 12) },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'STAFF_PIN_SET',
        entityType: 'User',
        entityId: user.id,
      },
    });
    return { message: `PIN saved for ${user.firstName}.` };
  }
  async update(
    businessId: string,
    userId: string,
    input: { role?: UserRole; branchId?: string; isActive?: boolean },
    actorId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId },
    });
    if (!user) throw new NotFoundException('Staff member not found.');
    if (user.role === 'OWNER')
      throw new ConflictException('The owner account cannot be edited here.');
    const branchId = input.branchId?.trim();
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, businessId },
      });
      if (!branch) throw new NotFoundException('Branch not found.');
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.branchId !== undefined ? { branchId: branchId || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        isActive: true, branch: { select: { id: true, name: true } },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId, actorId, action: 'STAFF_UPDATED', entityType: 'User',
        entityId: user.id, metadata: input,
      },
    });
    return updated;
  }
  async resetPassword(
    businessId: string,
    userId: string,
    password: string,
    actorId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId },
    });
    if (!user) throw new NotFoundException('Staff member not found.');
    if (user.role === 'OWNER')
      throw new ConflictException('Change the owner password from Account.');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(password, 12), isActive: true },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId, actorId, action: 'STAFF_PASSWORD_RESET', entityType: 'User', entityId: user.id,
      },
    });
    return { message: `Temporary password reset for ${user.firstName}.` };
  }
}
