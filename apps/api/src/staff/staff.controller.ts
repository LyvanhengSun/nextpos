import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsEmail,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../auth/auth.types';
import { StaffService } from './staff.service';
class CreateStaffDto {
  @IsEmail() email!: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsString() @MinLength(12) password!: string;
  @IsOptional() @Matches(/^\d{4,8}$/) pin?: string;
  @IsIn(['MANAGER', 'CASHIER']) role!: 'MANAGER' | 'CASHIER';
  @IsOptional() @IsString() branchId?: string;
}
class SetPinDto {
  @Matches(/^\d{4,8}$/) pin!: string;
}
class UpdateStaffDto {
  @IsOptional() @IsIn(['MANAGER', 'CASHIER']) role?: 'MANAGER' | 'CASHIER';
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class ResetPasswordDto {
  @IsString() @MinLength(12) password!: string;
}
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}
  @Get() list(@Req() req: { user: AuthUser }) {
    return this.staff.list(req.user.businessId);
  }
  @Post() create(
    @Req() req: { user: AuthUser },
    @Body() input: CreateStaffDto,
  ) {
    return this.staff.create(req.user.businessId, input, req.user.sub);
  }
  @Post(':id/pin') setPin(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: SetPinDto,
  ) {
    return this.staff.setPin(req.user.businessId, id, input.pin, req.user.sub);
  }
  @Patch(':id') update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: UpdateStaffDto,
  ) {
    return this.staff.update(req.user.businessId, id, input, req.user.sub);
  }
  @Post(':id/reset-password') resetPassword(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: ResetPasswordDto,
  ) {
    return this.staff.resetPassword(
      req.user.businessId,
      id,
      input.password,
      req.user.sub,
    );
  }
}
