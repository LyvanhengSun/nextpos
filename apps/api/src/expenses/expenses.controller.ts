import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ExpensesService } from './expenses.service';

class CreateExpenseDto {
  @IsString() category!: string;
  @IsInt() @Min(1) amount!: number;
  @IsIn(['CASH', 'BANK', 'CARD', 'KHQR']) paymentMethod!: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() expenseDate?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.service.list(req.user.businessId, req.user.branchId ?? undefined);
  }

  @Post()
  create(@Req() req: { user: AuthUser }, @Body() input: CreateExpenseDto) {
    if (!req.user.branchId) throw new Error('No active branch.');
    return this.service.create(
      req.user.businessId,
      req.user.branchId,
      req.user.sub,
      input,
    );
  }
}
