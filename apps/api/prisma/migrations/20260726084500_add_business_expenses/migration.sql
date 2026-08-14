-- CreateTable
CREATE TABLE "BusinessExpense" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "note" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessExpense_businessId_expenseDate_idx" ON "BusinessExpense"("businessId", "expenseDate");
CREATE INDEX "BusinessExpense_branchId_expenseDate_idx" ON "BusinessExpense"("branchId", "expenseDate");

ALTER TABLE "BusinessExpense" ADD CONSTRAINT "BusinessExpense_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessExpense" ADD CONSTRAINT "BusinessExpense_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
