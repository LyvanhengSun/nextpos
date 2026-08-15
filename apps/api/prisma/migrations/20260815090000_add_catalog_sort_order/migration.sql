-- Add ordering fields used by the catalog workspace.
ALTER TABLE "Product"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Category"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
