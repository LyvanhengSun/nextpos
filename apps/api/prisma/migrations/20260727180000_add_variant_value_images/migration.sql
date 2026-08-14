CREATE TABLE "ProductVariantOptionValueImage" (
    "id" TEXT NOT NULL,
    "optionValueId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductVariantOptionValueImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductVariantOptionValueImage_optionValueId_position_idx"
  ON "ProductVariantOptionValueImage"("optionValueId", "position");

ALTER TABLE "ProductVariantOptionValueImage"
  ADD CONSTRAINT "ProductVariantOptionValueImage_optionValueId_fkey"
  FOREIGN KEY ("optionValueId") REFERENCES "ProductVariantOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
