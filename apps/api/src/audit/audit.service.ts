import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const actorIds = [...new Set(logs.flatMap((log) => (log.actorId ? [log.actorId] : [])))];
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { businessId, id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const actors = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`]));
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt,
      actor: log.actorId ? actors.get(log.actorId) ?? 'Former staff member' : 'System',
    }));
  }
}
