CREATE TABLE "SupplierInvoice" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "supplierId" TEXT NOT NULL, "purchaseOrderId" TEXT, "invoiceNumber" TEXT NOT NULL, "total" INTEGER NOT NULL, "dueDate" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'UNPAID', "note" TEXT, "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SupplierInvoicePayment" (
  "id" TEXT NOT NULL, "supplierInvoiceId" TEXT NOT NULL, "amount" INTEGER NOT NULL, "paymentMethod" TEXT NOT NULL, "note" TEXT, "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "recordedById" TEXT NOT NULL,
  CONSTRAINT "SupplierInvoicePayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierInvoice_businessId_invoiceNumber_key" ON "SupplierInvoice"("businessId", "invoiceNumber");
CREATE INDEX "SupplierInvoice_supplierId_status_idx" ON "SupplierInvoice"("supplierId", "status");
CREATE INDEX "SupplierInvoicePayment_supplierInvoiceId_paidAt_idx" ON "SupplierInvoicePayment"("supplierInvoiceId", "paidAt");
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoicePayment" ADD CONSTRAINT "SupplierInvoicePayment_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
