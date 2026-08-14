ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "code" TEXT;

WITH numbered_suppliers AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "businessId"
      ORDER BY "createdAt", "id"
    ) AS sequence_number
  FROM "Supplier"
)
UPDATE "Supplier"
SET "code" = 'SUP-' || LPAD(numbered_suppliers.sequence_number::text, 3, '0')
FROM numbered_suppliers
WHERE "Supplier"."id" = numbered_suppliers."id"
  AND "Supplier"."code" IS NULL;

ALTER TABLE "Supplier" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_businessId_code_key" ON "Supplier"("businessId", "code");
