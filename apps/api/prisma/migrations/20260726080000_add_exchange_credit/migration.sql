ALTER TABLE "Sale" ADD COLUMN "exchangeSourceSaleId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "exchangeCredit" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Sale_exchangeSourceSaleId_idx" ON "Sale"("exchangeSourceSaleId");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_exchangeSourceSaleId_fkey" FOREIGN KEY ("exchangeSourceSaleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
