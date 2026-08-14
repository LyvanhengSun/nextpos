import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';

type Credentials = { email: string; password: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async activateOwner(input: Credentials) {
    if (process.env.NODE_ENV === 'production')
      throw new ForbiddenException('Use the production invitation flow.');
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user || user.role !== 'OWNER')
      throw new UnauthorizedException('Owner account not found.');
    if (user.passwordHash)
      throw new ConflictException('This owner account is already activated.');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(input.password, 12) },
    });
    return { message: 'Password created. You can now sign in.' };
  }

  async login(input: Credentials) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (
      !user?.passwordHash ||
      !user.isActive ||
      !(await compare(input.password, user.passwordHash))
    )
      throw new UnauthorizedException('Invalid email or password.');
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      businessId: user.businessId,
      branchId: user.branchId,
      role: user.role,
    });
    return { accessToken, user: this.safeUser(user) };
  }

  async me(id: string, activeBranchId?: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive)
      throw new UnauthorizedException('User account is unavailable.');
    const fallbackBranch = user.branchId
      ? null
      : await this.prisma.branch.findFirst({
          where: { businessId: user.businessId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
    const selectedBranch = activeBranchId
      ? await this.prisma.branch.findFirst({
          where: { id: activeBranchId, businessId: user.businessId },
          select: { id: true },
        })
      : null;
    return {
      ...this.safeUser(user),
      branchId:
        selectedBranch?.id ?? user.branchId ?? fallbackBranch?.id ?? null,
    };
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (
      !user?.passwordHash ||
      !(await compare(currentPassword, user.passwordHash))
    )
      throw new UnauthorizedException('Current password is incorrect.');
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await hash(newPassword, 12) },
    });
    return { message: 'Password changed.' };
  }

  async switchBranch(id: string, branchId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive)
      throw new UnauthorizedException('User account is unavailable.');
    if (user.role === 'CASHIER')
      throw new ForbiddenException(
        'Cashiers can only use their assigned branch.',
      );
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, businessId: user.businessId },
    });
    if (!branch)
      throw new ForbiddenException('This branch is not part of your business.');
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      businessId: user.businessId,
      branchId: branch.id,
      role: user.role,
    });
    return {
      accessToken,
      branch: { id: branch.id, name: branch.name, code: branch.code },
    };
  }

  async terminalUsers(businessId: string, branchId?: string | null) {
    return this.prisma.user.findMany({
      where: {
        businessId,
        isActive: true,
        pinHash: { not: null },
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }

  async terminalUnlock(
    businessId: string,
    userId: string,
    pin: string,
    actorId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId, isActive: true },
    });
    if (!user?.pinHash || !(await compare(pin, user.pinHash)))
      throw new UnauthorizedException('Incorrect PIN.');
    const fallbackBranch = user.branchId
      ? null
      : await this.prisma.branch.findFirst({
          where: { businessId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
    const branchId = user.branchId ?? fallbackBranch?.id ?? null;
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      businessId: user.businessId,
      branchId,
      role: user.role,
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        actorId,
        action: 'TERMINAL_UNLOCKED',
        entityType: 'User',
        entityId: user.id,
      },
    });
    return { accessToken, user: { ...this.safeUser(user), branchId } };
  }

  async managerApprovers(businessId: string, branchId?: string | null) {
    return this.prisma.user.findMany({
      where: {
        businessId, isActive: true, pinHash: { not: null },
        role: { in: ['OWNER', 'MANAGER'] },
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }

  async managerApprove(
    businessId: string, branchId: string | null | undefined, cashierId: string,
    managerId: string, pin: string, action: 'DISCOUNT' | 'CASH_OUT' | 'RETURN',
  ) {
    const manager = await this.prisma.user.findFirst({
      where: {
        id: managerId, businessId, isActive: true,
        role: { in: ['OWNER', 'MANAGER'] },
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
    });
    if (!manager?.pinHash || !(await compare(pin, manager.pinHash)))
      throw new UnauthorizedException('Incorrect manager PIN.');
    const approvalToken = await this.jwt.signAsync({
      purpose: 'MANAGER_APPROVAL', action, businessId, branchId: branchId ?? null,
      cashierId, approvedBy: manager.id,
    }, { expiresIn: '2m' });
    await this.prisma.auditLog.create({
      data: { businessId, actorId: manager.id, action: 'MANAGER_APPROVAL_GRANTED', entityType: 'ManagerApproval', entityId: cashierId, metadata: { action, branchId: branchId ?? null } },
    });
    return { approvalToken, manager: { id: manager.id, firstName: manager.firstName, lastName: manager.lastName } };
  }

  private safeUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    businessId: string;
    branchId: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      businessId: user.businessId,
      branchId: user.branchId,
    };
  }
}
