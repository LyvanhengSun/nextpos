ALTER TABLE "PurchaseOrder" ADD COLUMN "expectedDeliveryDate" TIMESTAMP(3);

CREATE INDEX "PurchaseOrder_expectedDeliveryDate_idx" ON "PurchaseOrder"("expectedDeliveryDate");
