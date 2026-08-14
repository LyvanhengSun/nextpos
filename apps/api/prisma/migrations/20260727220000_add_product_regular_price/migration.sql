ALTER TABLE "Product" ADD COLUMN "regularPrice" INTEGER;
ALTER TABLE "Product" ALTER COLUMN "price" DROP NOT NULL;

UPDATE "Product"
SET "regularPrice" = "price", "price" = NULL
WHERE "regularPrice" IS NULL;
