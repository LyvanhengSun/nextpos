ALTER TABLE "PurchaseOrder"
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedById" TEXT,
  ADD COLUMN "rejectionReason" TEXT;

CREATE INDEX "PurchaseOrder_rejectedById_idx" ON "PurchaseOrder"("rejectedById");

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_rejectedById_fkey"
  FOREIGN KEY ("rejectedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
