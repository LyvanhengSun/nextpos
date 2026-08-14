-- Allow a purchase-order line to name one exact retail variant.
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "variantId" TEXT;

DROP INDEX "PurchaseOrderItem_purchaseOrderId_productId_key";
CREATE UNIQUE INDEX "PurchaseOrderItem_purchaseOrderId_productId_variantId_key"
  ON "PurchaseOrderItem"("purchaseOrderId", "productId", "variantId");
CREATE INDEX "PurchaseOrderItem_variantId_idx" ON "PurchaseOrderItem"("variantId");

ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
