import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
@Module({ imports: [AuthModule, JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_SECRET }) })], controllers: [InventoryController], providers: [InventoryService] }) export class InventoryModule {}
