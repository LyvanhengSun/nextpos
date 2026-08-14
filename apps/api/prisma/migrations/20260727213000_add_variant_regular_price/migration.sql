ALTER TABLE "ProductVariant" ADD COLUMN "regularPrice" INTEGER;

UPDATE "ProductVariant"
SET "regularPrice" = "price"
WHERE "regularPrice" IS NULL;
