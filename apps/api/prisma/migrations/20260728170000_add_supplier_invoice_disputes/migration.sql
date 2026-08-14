ALTER TABLE "SupplierInvoice"
  ADD COLUMN "disputeStatus" TEXT,
  ADD COLUMN "disputeReason" TEXT,
  ADD COLUMN "disputeReference" TEXT,
  ADD COLUMN "disputedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedAt" TIMESTAMP(3);
