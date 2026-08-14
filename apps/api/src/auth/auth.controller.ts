import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsString, Matches, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthUser } from './auth.types';

class CredentialsDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string;
}
class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(12) newPassword!: string;
}
class SwitchBranchDto {
  @IsString() branchId!: string;
}
class TerminalUnlockDto {
  @IsString() userId!: string;
  @Matches(/^\d{4,8}$/) pin!: string;
}
class ManagerApprovalDto {
  @IsString() userId!: string;
  @Matches(/^\d{4,8}$/) pin!: string;
  @IsIn(['DISCOUNT', 'CASH_OUT', 'RETURN']) action!: 'DISCOUNT' | 'CASH_OUT' | 'RETURN';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('activate-owner') activate(@Body() input: CredentialsDto) {
    return this.auth.activateOwner(input);
  }
  @Post('login') login(@Body() input: CredentialsDto) {
    return this.auth.login(input);
  }
  @UseGuards(JwtAuthGuard) @Get('me') me(@Req() request: { user: AuthUser }) {
    return this.auth.me(request.user.sub, request.user.branchId);
  }
  @UseGuards(JwtAuthGuard) @Post('change-password') changePassword(
    @Req() request: { user: AuthUser },
    @Body() input: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      request.user.sub,
      input.currentPassword,
      input.newPassword,
    );
  }
  @UseGuards(JwtAuthGuard) @Post('switch-branch') switchBranch(
    @Req() request: { user: AuthUser },
    @Body() input: SwitchBranchDto,
  ) {
    return this.auth.switchBranch(request.user.sub, input.branchId);
  }
  @UseGuards(JwtAuthGuard) @Get('terminal-users') terminalUsers(
    @Req() request: { user: AuthUser },
  ) {
    return this.auth.terminalUsers(
      request.user.businessId,
      request.user.branchId,
    );
  }
  @UseGuards(JwtAuthGuard) @Post('terminal-unlock') terminalUnlock(
    @Req() request: { user: AuthUser },
    @Body() input: TerminalUnlockDto,
  ) {
    return this.auth.terminalUnlock(
      request.user.businessId,
      input.userId,
      input.pin,
      request.user.sub,
    );
  }
  @UseGuards(JwtAuthGuard) @Get('manager-approvers') managerApprovers(
    @Req() request: { user: AuthUser },
  ) {
    return this.auth.managerApprovers(request.user.businessId, request.user.branchId);
  }
  @UseGuards(JwtAuthGuard) @Post('manager-approve') managerApprove(
    @Req() request: { user: AuthUser },
    @Body() input: ManagerApprovalDto,
  ) {
    return this.auth.managerApprove(
      request.user.businessId, request.user.branchId, request.user.sub,
      input.userId, input.pin, input.action,
    );
  }
}
