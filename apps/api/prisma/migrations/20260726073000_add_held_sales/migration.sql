CREATE TABLE "HeldSale" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "customerId" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeldSale_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HeldSale_businessId_branchId_updatedAt_idx" ON "HeldSale"("businessId", "branchId", "updatedAt");

ALTER TABLE "HeldSale" ADD CONSTRAINT "HeldSale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HeldSale" ADD CONSTRAINT "HeldSale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HeldSale" ADD CONSTRAINT "HeldSale_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
