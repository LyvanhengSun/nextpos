import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PosService } from './pos.service';
class CartItemDto {
  @IsString() productId!: string;
  @IsOptional() @IsString() variantId?: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifierOptionIds?: string[];
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
class CheckoutDto {
  @IsString() branchId!: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() clientTransactionId?: string;
  @IsOptional() @IsString() exchangeSourceSaleId?: string;
  @IsOptional() @IsInt() @Min(0) exchangeCredit?: number;
  @IsIn(['CASH', 'CARD', 'KHQR', 'GIFT_CARD']) paymentMethod!: string;
  @IsOptional() @IsString() giftCardCode?: string;
  @IsOptional() @IsInt() @Min(0) amountTendered?: number;
  @IsOptional() @IsInt() @Min(0) discountTotal?: number;
  @IsOptional() @IsString() promotionId?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() managerApprovalToken?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
class RefundDto {
  @IsString() @MinLength(3) reason!: string;
  @IsOptional() @IsString() managerApprovalToken?: string;
}
class ReturnLineDto {
  @IsString() saleItemId!: string;
  @IsInt() @Min(1) quantity!: number;
}
class PartialRefundDto extends RefundDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items!: ReturnLineDto[];
}
class HoldSaleDto {
  @IsString() branchId!: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsIn(['CASH', 'CARD', 'KHQR']) paymentMethod!: string;
  @IsOptional() @IsInt() @Min(0) discountTotal?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsArray() items!: unknown[];
}
@UseGuards(JwtAuthGuard)
@Controller('pos')
export class PosController {
  constructor(private readonly pos: PosService) {}
  @Get('catalog') catalog(
    @Req() req: { user: AuthUser },
    @Query('branchId') branchId: string,
  ) {
    return this.pos.catalog(req.user.businessId, branchId);
  }
  @Post('checkout') checkout(
    @Req() req: { user: AuthUser },
    @Body() input: CheckoutDto,
  ) {
    return this.pos.checkout(
      req.user.businessId,
      req.user.sub,
      req.user.role,
      input,
    );
  }
  @Get('held') held(
    @Req() req: { user: AuthUser },
    @Query('branchId') branchId: string,
  ) {
    return this.pos.held(req.user.businessId, branchId);
  }
  @Post('held') hold(
    @Req() req: { user: AuthUser },
    @Body() input: HoldSaleDto,
  ) {
    return this.pos.hold(req.user.businessId, req.user.sub, input);
  }
  @Delete('held/:id') removeHeld(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.pos.removeHeld(req.user.businessId, id);
  }
  @Get('sales') history(
    @Req() req: { user: AuthUser },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: 'all' | 'completed' | 'returned',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.pos.history(req.user.businessId, req.user.sub, req.user.role, {
      page: Number(page), pageSize: Number(pageSize), status, from, to,
    });
  }
  @Get('sales/:id') receipt(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.pos.receipt(req.user.businessId, id, req.user.sub, req.user.role);
  }
  @Post('sales/:id/refund')
  refund(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: RefundDto,
  ) {
    return this.pos.refund(req.user.businessId, id, req.user.sub, req.user.role, input.reason, input.managerApprovalToken);
  }
  @Post('sales/:id/return-items')
  returnItems(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: PartialRefundDto,
  ) {
    return this.pos.returnItems(
      req.user.businessId,
      id,
      req.user.sub,
      req.user.role,
      input.reason,
      input.items,
      input.managerApprovalToken,
    );
  }
}
