CREATE TABLE "SupplierInvoiceCredit" (
  "id" TEXT NOT NULL,
  "supplierInvoiceId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierInvoiceCredit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupplierInvoiceCredit_supplierInvoiceId_createdAt_idx" ON "SupplierInvoiceCredit"("supplierInvoiceId", "createdAt");
ALTER TABLE "SupplierInvoiceCredit" ADD CONSTRAINT "SupplierInvoiceCredit_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
