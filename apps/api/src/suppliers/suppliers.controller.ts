import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SuppliersService } from './suppliers.service';

class CreateSupplierDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsOptional() @IsString() phone?: string;
  @ValidateIf((_, value) => value !== '') @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
}
class UpdateSupplierDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() phone?: string;
  @ValidateIf((_, value) => value !== '') @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}
  @Get() list(
    @Req() request: { user: AuthUser },
    @Query('includeInactive') includeInactive?: string,
    @Query('includeSummary') includeSummary?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.suppliers.list(
      request.user.businessId,
      includeInactive === 'true',
      includeSummary === 'true',
      from,
      to,
    );
  }
  @Get(':supplierId/catalog') catalog(
    @Req() request: { user: AuthUser },
    @Param('supplierId') supplierId: string,
  ) {
    return this.suppliers.catalog(request.user.businessId, supplierId);
  }
  @Get(':supplierId') detail(
    @Req() request: { user: AuthUser },
    @Param('supplierId') supplierId: string,
  ) {
    return this.suppliers.detail(request.user.businessId, supplierId);
  }
  @Post() create(
    @Req() request: { user: AuthUser },
    @Body() input: CreateSupplierDto,
  ) {
    return this.suppliers.create(
      request.user.businessId,
      request.user.sub,
      input,
    );
  }
  @Patch(':supplierId') update(
    @Req() request: { user: AuthUser },
    @Param('supplierId') supplierId: string,
    @Body() input: UpdateSupplierDto,
  ) {
    return this.suppliers.update(
      request.user.businessId,
      request.user.sub,
      supplierId,
      input,
    );
  }
}
