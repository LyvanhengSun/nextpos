ALTER TABLE "PurchaseOrder"
  ADD COLUMN "dispatchedAt" TIMESTAMP(3),
  ADD COLUMN "dispatchedById" TEXT;

CREATE INDEX "PurchaseOrder_dispatchedById_idx" ON "PurchaseOrder"("dispatchedById");

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_dispatchedById_fkey"
  FOREIGN KEY ("dispatchedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
