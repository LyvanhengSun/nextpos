CREATE TABLE "ProductVariantOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariantOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariantOptionValue" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariantOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariantSelection" (
    "variantId" TEXT NOT NULL,
    "optionValueId" TEXT NOT NULL,
    CONSTRAINT "ProductVariantSelection_pkey" PRIMARY KEY ("variantId", "optionValueId")
);

CREATE UNIQUE INDEX "ProductVariantOption_productId_name_key" ON "ProductVariantOption"("productId", "name");
CREATE INDEX "ProductVariantOption_productId_position_idx" ON "ProductVariantOption"("productId", "position");
CREATE UNIQUE INDEX "ProductVariantOptionValue_optionId_name_key" ON "ProductVariantOptionValue"("optionId", "name");
CREATE INDEX "ProductVariantOptionValue_optionId_position_idx" ON "ProductVariantOptionValue"("optionId", "position");
CREATE INDEX "ProductVariantSelection_optionValueId_idx" ON "ProductVariantSelection"("optionValueId");

ALTER TABLE "ProductVariantOption" ADD CONSTRAINT "ProductVariantOption_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ProductVariantOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariantSelection" ADD CONSTRAINT "ProductVariantSelection_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariantSelection" ADD CONSTRAINT "ProductVariantSelection_optionValueId_fkey"
  FOREIGN KEY ("optionValueId") REFERENCES "ProductVariantOptionValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
