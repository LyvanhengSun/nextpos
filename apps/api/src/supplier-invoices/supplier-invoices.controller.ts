import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupplierInvoicesService } from './supplier-invoices.service';
class CreateInvoiceDto {
  @IsString() supplierId!: string;
  @IsString() invoiceNumber!: string;
  @IsInt() @Min(1) total!: number;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() purchaseOrderId?: string;
  @IsOptional() @IsString() note?: string;
}
class AddPaymentDto {
  @IsInt() @Min(1) amount!: number;
  @IsIn(['CASH', 'BANK', 'CARD', 'KHQR']) paymentMethod!: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() overrideReason?: string;
}
class DisputeInvoiceDto {
  @IsString() reason!: string;
  @IsOptional() @IsString() reference?: string;
}
class AddCreditDto {
  @IsInt() @Min(1) amount!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
}
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
@Controller('supplier-invoices')
export class SupplierInvoicesController {
  constructor(private readonly service: SupplierInvoicesService) {}
  @Get() list(@Req() req: { user: AuthUser }) {
    return this.service.list(req.user.businessId);
  }
  @Post() create(
    @Req() req: { user: AuthUser },
    @Body() input: CreateInvoiceDto,
  ) {
    if (!req.user.branchId) throw new Error('No active branch.');
    return this.service.create(
      req.user.businessId,
      req.user.branchId,
      req.user.sub,
      input,
    );
  }
  @Post(':id/payments') pay(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: AddPaymentDto,
  ) {
    return this.service.pay(
      req.user.businessId,
      req.user.sub,
      req.user.role,
      id,
      input,
    );
  }
  @Post(':id/dispute') dispute(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: DisputeInvoiceDto,
  ) {
    return this.service.dispute(req.user.businessId, req.user.sub, id, input);
  }
  @Post(':id/resolve-dispute') resolveDispute(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: DisputeInvoiceDto,
  ) {
    return this.service.resolveDispute(
      req.user.businessId,
      req.user.sub,
      id,
      input,
    );
  }
  @Post(':id/credits') credit(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: AddCreditDto,
  ) {
    return this.service.addCredit(req.user.businessId, req.user.sub, id, input);
  }
}
