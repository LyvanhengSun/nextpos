CREATE TABLE "GiftCard" ("id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "code" TEXT NOT NULL, "balance" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "GiftCard_businessId_code_key" ON "GiftCard"("businessId", "code");
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
