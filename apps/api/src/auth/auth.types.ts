import { UserRole } from '@prisma/client';

export interface AuthUser { sub: string; businessId: string; branchId: string | null; role: UserRole; }
