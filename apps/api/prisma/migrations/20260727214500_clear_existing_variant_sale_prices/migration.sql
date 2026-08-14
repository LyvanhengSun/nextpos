-- Existing variants were created before sale pricing existed. Their old price
-- is already retained in regularPrice, so leave sale price empty by default.
UPDATE "ProductVariant"
SET "price" = NULL
WHERE "regularPrice" IS NOT NULL;
