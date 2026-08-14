import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  MinLength,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PurchaseOrdersService } from './purchase-orders.service';

class PurchaseOrderItemDto {
  @IsString() productId!: string;
  @IsOptional() @IsString() variantId?: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsInt() @Min(0) unitCost?: number;
}
class CreatePurchaseOrderDto {
  @IsString() supplierId!: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}
class ReceivePurchaseOrderLineDto {
  @IsString() purchaseOrderItemId!: string;
  @IsInt() @Min(1) quantity!: number;
}
class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderLineDto)
  items!: ReceivePurchaseOrderLineDto[];
}
class UpdatePurchaseOrderItemDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() variantId?: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsInt() @Min(0) unitCost?: number | null;
}
class UpdatePurchaseOrderDto {
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseOrderItemDto)
  items?: UpdatePurchaseOrderItemDto[];
}
class RejectPurchaseOrderDto {
  @IsString() @MinLength(1) reason!: string;
}
class ConfirmSupplierPurchaseOrderDto {
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsDateString() confirmedDeliveryDate?: string;
}
class PurchaseOrderChangeItemDto {
  @IsString() id!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsInt() @Min(0) unitCost?: number | null;
}
class CreatePurchaseOrderChangeRequestDto {
  @IsString() @MinLength(1) reason!: string;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderChangeItemDto)
  items!: PurchaseOrderChangeItemDto[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}
  @Get() list(@Req() req: { user: AuthUser }) {
    return this.service.list(req.user.businessId);
  }
  @Post() create(
    @Req() req: { user: AuthUser },
    @Body() input: CreatePurchaseOrderDto,
  ) {
    if (!req.user.branchId) throw new Error('No active branch.');
    return this.service.create(
      req.user.businessId,
      req.user.branchId,
      req.user.sub,
      input,
    );
  }
  @Post(':id/receive') receive(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: ReceivePurchaseOrderDto,
  ) {
    return this.service.receive(
      req.user.businessId,
      req.user.sub,
      id,
      input.items,
    );
  }
  @Post(':id/submit') submit(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.service.submitForApproval(
      req.user.businessId,
      req.user.sub,
      id,
    );
  }
  @Post(':id/approve')
  @Roles('OWNER')
  approve(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.approve(req.user.businessId, req.user.sub, id);
  }
  @Post(':id/reject')
  @Roles('OWNER')
  reject(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: RejectPurchaseOrderDto,
  ) {
    return this.service.reject(
      req.user.businessId,
      req.user.sub,
      id,
      input.reason,
    );
  }
  @Post(':id/dispatch')
  dispatch(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.dispatch(req.user.businessId, req.user.sub, id);
  }
  @Post(':id/confirm-supplier')
  confirmSupplier(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: ConfirmSupplierPurchaseOrderDto,
  ) {
    return this.service.confirmSupplier(
      req.user.businessId,
      req.user.sub,
      id,
      input,
    );
  }
  @Post(':id/change-requests')
  requestChange(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: CreatePurchaseOrderChangeRequestDto,
  ) {
    return this.service.requestChange(
      req.user.businessId,
      req.user.sub,
      id,
      input,
    );
  }
  @Post('change-requests/:requestId/approve')
  @Roles('OWNER')
  approveChange(
    @Req() req: { user: AuthUser },
    @Param('requestId') requestId: string,
  ) {
    return this.service.approveChange(
      req.user.businessId,
      req.user.sub,
      requestId,
    );
  }
  @Post(':id/cancel') cancel(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.service.cancel(req.user.businessId, req.user.sub, id);
  }
  @Patch(':id') update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: UpdatePurchaseOrderDto,
  ) {
    return this.service.update(req.user.businessId, req.user.sub, id, input);
  }
}
