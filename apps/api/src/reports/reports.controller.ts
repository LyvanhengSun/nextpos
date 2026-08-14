import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('daily')
  daily(@Req() request: { user: AuthUser }) {
    return this.reports.daily(
      request.user.businessId,
      request.user.branchId ?? undefined,
    );
  }
  @Get('overview')
  overview(@Req() request: { user: AuthUser }) {
    return this.reports.overview(
      request.user.businessId,
      request.user.branchId ?? undefined,
    );
  }
  @Get('range')
  range(
    @Req() request: { user: AuthUser },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.range(
      request.user.businessId,
      request.user.branchId ?? undefined,
      from,
      to,
    );
  }
}
