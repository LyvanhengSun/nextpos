import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';

class CreateBranchDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MinLength(2) @MaxLength(24) code!: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
}
class UpdateBranchDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(24) code?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
}
class UpdateSettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(10000) taxRateBasisPoints?: number;
  @IsOptional() @IsInt() @Min(0) defaultInventoryAlertLevel?: number;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(60) phone?: string;
  @IsOptional() @IsString() @MaxLength(12) receiptPrefix?: string;
  @IsOptional() @IsString() @MaxLength(240) receiptFooter?: string;
}

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  create(@Body() input: CreateBusinessDto) {
    return this.businesses.create(input);
  }

  @Get()
  findAll() {
    return this.businesses.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'CASHIER')
  @Get('current/branches')
  branches(@Req() request: { user: AuthUser }) {
    return this.businesses.listBranches(request.user.businessId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'CASHIER')
  @Get('current/settings')
  settings(@Req() request: { user: AuthUser }) {
    return this.businesses.settings(request.user.businessId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  @Patch('current/settings')
  updateSettings(
    @Req() request: { user: AuthUser },
    @Body() input: UpdateSettingsDto,
  ) {
    return this.businesses.updateSettings(
      request.user.businessId,
      request.user.sub,
      input,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  @Post('current/branches')
  createBranch(@Req() request: { user: AuthUser }, @Body() input: CreateBranchDto) {
    return this.businesses.createBranch(request.user.businessId, input, request.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  @Patch('current/branches/:branchId')
  updateBranch(@Req() request: { user: AuthUser }, @Param('branchId') branchId: string, @Body() input: UpdateBranchDto) {
    return this.businesses.updateBranch(request.user.businessId, branchId, input, request.user.sub);
  }
}
