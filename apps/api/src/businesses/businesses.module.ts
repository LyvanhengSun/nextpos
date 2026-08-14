import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [AuthModule, JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_SECRET }) })],
  controllers: [BusinessesController],
  providers: [BusinessesService],
})
export class BusinessesModule {}
