import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CustomersService } from './customers.service';

class CreateCustomerDto { @IsString() @MinLength(2) name!: string; @IsOptional() @IsString() phone?: string; @IsOptional() @IsEmail() email?: string; @IsOptional() @IsString() note?: string; }
class UpdateCustomerDto { @IsOptional() @IsString() @MinLength(2) name?: string; @IsOptional() @IsString() phone?: string; @IsOptional() @IsEmail() email?: string; @IsOptional() @IsString() note?: string; @IsOptional() @IsBoolean() isActive?: boolean; }
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}
  @Get() list(@Req() request: { user: AuthUser }, @Query('includeInactive') includeInactive?: string) { return this.customers.list(request.user.businessId, includeInactive === 'true'); }
  @Post() create(@Req() request: { user: AuthUser }, @Body() input: CreateCustomerDto) { return this.customers.create(request.user.businessId, input); }
  @Patch(':customerId')
  @Roles('OWNER', 'MANAGER')
  update(@Req() request: { user: AuthUser }, @Param('customerId') customerId: string, @Body() input: UpdateCustomerDto) { return this.customers.update(request.user.businessId, customerId, input); }
  @Delete(':customerId')
  @Roles('OWNER', 'MANAGER')
  remove(@Req() request: { user: AuthUser }, @Param('customerId') customerId: string) { return this.customers.remove(request.user.businessId, customerId); }
}
