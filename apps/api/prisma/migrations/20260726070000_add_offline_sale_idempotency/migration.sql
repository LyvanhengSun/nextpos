-- A device-generated transaction ID makes offline checkout retries idempotent.
ALTER TABLE "Sale" ADD COLUMN "clientTransactionId" TEXT;

CREATE UNIQUE INDEX "Sale_businessId_clientTransactionId_key"
ON "Sale"("businessId", "clientTransactionId");
