CREATE TABLE "ProductVariantStockMovement" (
    "id" TEXT NOT NULL,
    "productVariantInventoryId" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariantStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductVariantStockMovement_productVariantInventoryId_createdAt_idx"
ON "ProductVariantStockMovement"("productVariantInventoryId", "createdAt");

ALTER TABLE "ProductVariantStockMovement"
ADD CONSTRAINT "ProductVariantStockMovement_productVariantInventoryId_fkey"
FOREIGN KEY ("productVariantInventoryId") REFERENCES "ProductVariantInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
