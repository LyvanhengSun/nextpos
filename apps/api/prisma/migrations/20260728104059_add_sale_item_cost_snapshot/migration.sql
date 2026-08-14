-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "unitCost" INTEGER;

-- RenameIndex
ALTER INDEX "ProductVariantStockMovement_productVariantInventoryId_createdAt" RENAME TO "ProductVariantStockMovement_productVariantInventoryId_creat_idx";
