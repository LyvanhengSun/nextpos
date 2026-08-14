-- CreateTable
CREATE TABLE "ModifierOptionSet" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelections" INTEGER NOT NULL DEFAULT 0,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierOptionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierOptionSetItem" (
    "id" TEXT NOT NULL,
    "optionSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModifierOptionSetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModifierOptionSet_businessId_name_key" ON "ModifierOptionSet"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ModifierOptionSetItem_optionSetId_name_key" ON "ModifierOptionSetItem"("optionSetId", "name");

-- AddForeignKey
ALTER TABLE "ModifierOptionSet" ADD CONSTRAINT "ModifierOptionSet_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModifierOptionSetItem" ADD CONSTRAINT "ModifierOptionSetItem_optionSetId_fkey" FOREIGN KEY ("optionSetId") REFERENCES "ModifierOptionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
