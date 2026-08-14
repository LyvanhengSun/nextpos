ALTER TABLE "Sale"
  ADD COLUMN "subtotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountTotal" INTEGER NOT NULL DEFAULT 0;

UPDATE "Sale" SET "subtotal" = "total" WHERE "subtotal" = 0;
