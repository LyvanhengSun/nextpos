import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PromotionsService } from './promotions.service';
class CreatePromotionDto { @IsString() @MaxLength(80) name!: string; @IsIn(['PERCENT','FIXED','BUY_X_GET_Y']) type!: string; @IsInt() @Min(0) value!: number; @IsOptional() @IsInt() @Min(0) minimumSpend?: number; @IsOptional() @IsString() productId?: string; @IsOptional() @IsString() categoryId?: string; @IsOptional() @IsInt() @Min(1) buyQuantity?: number; @IsOptional() @IsInt() @Min(1) rewardQuantity?: number; @IsOptional() @IsString() startsAt?: string; @IsOptional() @IsString() endsAt?: string; }
@UseGuards(JwtAuthGuard)
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}
  @Get('active') active(@Req() req: { user: AuthUser }) { return this.service.active(req.user.businessId); }
  @UseGuards(RolesGuard) @Roles('OWNER','MANAGER') @Get() list(@Req() req: { user: AuthUser }) { return this.service.list(req.user.businessId); }
  @UseGuards(RolesGuard) @Roles('OWNER','MANAGER') @Post() create(@Req() req: { user: AuthUser }, @Body() input: CreatePromotionDto) { return this.service.create(req.user.businessId, input); }
  @UseGuards(RolesGuard) @Roles('OWNER','MANAGER') @Post(':id/toggle') toggle(@Req() req: { user: AuthUser }, @Param('id') id: string) { return this.service.toggle(req.user.businessId, id); }
}
