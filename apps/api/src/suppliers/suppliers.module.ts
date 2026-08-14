import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({ imports: [AuthModule, JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_SECRET }) })], controllers: [SuppliersController], providers: [SuppliersService] })
export class SuppliersModule {}
