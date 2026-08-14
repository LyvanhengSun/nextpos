import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

// This command exists only for a local development database. Production password
// recovery must use a verified email-reset flow instead.
config({ path: resolve(__dirname, '../../.env') });

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('This command is disabled in production.');
  const [email, newPassword] = process.argv.slice(2).filter((argument) => argument !== '--');
  if (!email || !newPassword) throw new Error('Usage: pnpm --filter @pos/api reset:owner -- owner@email.com "new-password"');
  if (newPassword.length < 12) throw new Error('New password must be at least 12 characters.');

  const prisma = new PrismaClient();
  try {
    const owner = await prisma.user.findFirst({ where: { email: email.toLowerCase(), role: 'OWNER' } });
    if (!owner) {
      const owners = await prisma.user.findMany({ where: { role: 'OWNER' }, select: { email: true }, orderBy: { createdAt: 'asc' } });
      const available = owners.map((user) => user.email).join(', ') || 'none';
      throw new Error(`No owner account was found for this email. Owner email(s) in this local database: ${available}`);
    }
    await prisma.user.update({ where: { id: owner.id }, data: { passwordHash: await hash(newPassword, 12), isActive: true } });
    await prisma.auditLog.create({ data: { businessId: owner.businessId, actorId: owner.id, action: 'LOCAL_OWNER_PASSWORD_RESET', entityType: 'User', entityId: owner.id } });
    console.log(`Password reset for ${owner.email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
