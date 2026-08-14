ALTER TABLE "Sale"
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "refundedById" TEXT,
  ADD COLUMN "refundReason" TEXT;
