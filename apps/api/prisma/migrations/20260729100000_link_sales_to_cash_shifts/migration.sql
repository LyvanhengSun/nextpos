ALTER TABLE "Sale" ADD COLUMN "cashShiftId" TEXT;
CREATE INDEX "Sale_cashShiftId_idx" ON "Sale"("cashShiftId");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashShiftId_fkey" FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
