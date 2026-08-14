import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [
    AuthModule,
    JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_SECRET }) }),
  ],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
