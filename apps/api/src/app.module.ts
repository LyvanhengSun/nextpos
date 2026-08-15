import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { StaffModule } from './staff/staff.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { PosModule } from './pos/pos.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ReportsModule } from './reports/reports.module';
import { CustomersModule } from './customers/customers.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { SupplierInvoicesModule } from './supplier-invoices/supplier-invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { AuditModule } from './audit/audit.module';
import { PromotionsModule } from './promotions/promotions.module';
import { GiftCardsModule } from './gift-cards/gift-cards.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    BusinessesModule,
    AuthModule,
    StaffModule,
    ProductsModule,
    InventoryModule,
    PosModule,
    ShiftsModule,
    ReportsModule,
    CustomersModule,
    SuppliersModule,
    PurchaseOrdersModule,
    SupplierInvoicesModule,
    ExpensesModule,
    AuditModule,
    PromotionsModule,
    GiftCardsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
