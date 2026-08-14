CREATE TABLE "SupplierCatalogItem" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "supplierSku" TEXT,
  "lastCost" INTEGER,
  "isPreferred" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierCatalogItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierCatalogItem_supplierId_productId_variantId_key" ON "SupplierCatalogItem"("supplierId", "productId", "variantId");
CREATE INDEX "SupplierCatalogItem_businessId_productId_idx" ON "SupplierCatalogItem"("businessId", "productId");
CREATE INDEX "SupplierCatalogItem_businessId_variantId_idx" ON "SupplierCatalogItem"("businessId", "variantId");
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
