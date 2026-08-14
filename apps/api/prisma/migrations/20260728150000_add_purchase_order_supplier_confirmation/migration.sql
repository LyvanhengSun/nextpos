ALTER TABLE "PurchaseOrder"
  ADD COLUMN "supplierConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "supplierConfirmationReference" TEXT,
  ADD COLUMN "confirmedDeliveryDate" TIMESTAMP(3);

CREATE INDEX "PurchaseOrder_confirmedDeliveryDate_idx" ON "PurchaseOrder"("confirmedDeliveryDate");
