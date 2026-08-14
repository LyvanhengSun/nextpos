-- Give each variant a direct tenant key. This keeps product data normalized while
-- making tenant-scoped variant searches and future catalog-wide tools efficient.
ALTER TABLE "ProductVariant" ADD COLUMN "businessId" TEXT;

UPDATE "ProductVariant" AS variant
SET "businessId" = product."businessId"
FROM "Product" AS product
WHERE variant."productId" = product."id";

ALTER TABLE "ProductVariant" ALTER COLUMN "businessId" SET NOT NULL;

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SKU and barcode must be unique within one business, even when variants are
-- attached to different products. Existing product links and variant IDs stay unchanged.
DROP INDEX "ProductVariant_productId_sku_key";
DROP INDEX "ProductVariant_barcode_idx";
CREATE UNIQUE INDEX "ProductVariant_businessId_sku_key" ON "ProductVariant"("businessId", "sku");
CREATE UNIQUE INDEX "ProductVariant_businessId_barcode_key" ON "ProductVariant"("businessId", "barcode");
CREATE INDEX "ProductVariant_businessId_isActive_idx" ON "ProductVariant"("businessId", "isActive");
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");
