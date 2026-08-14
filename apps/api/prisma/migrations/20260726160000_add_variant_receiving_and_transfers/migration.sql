-- A receipt or branch transfer can refer to one precise retail variant.
ALTER TABLE "StockReceipt" ADD COLUMN "variantId" TEXT;
ALTER TABLE "StockTransfer" ADD COLUMN "variantId" TEXT;

CREATE INDEX "StockReceipt_variantId_idx" ON "StockReceipt"("variantId");
CREATE INDEX "StockTransfer_variantId_idx" ON "StockTransfer"("variantId");

ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
