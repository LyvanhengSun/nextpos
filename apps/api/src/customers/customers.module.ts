import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({ imports: [AuthModule, JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_SECRET }) })], controllers: [CustomersController], providers: [CustomersService] })
export class CustomersModule {}
