import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
@Module({ imports: [AuthModule, JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_SECRET }) })], controllers: [ProductsController], providers: [ProductsService] }) export class ProductsModule {}
