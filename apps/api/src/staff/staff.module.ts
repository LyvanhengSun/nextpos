import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
@Module({
  imports: [
    AuthModule,
    JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_SECRET }) }),
  ],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
