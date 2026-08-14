CREATE TABLE "PurchaseOrderChangeRequest" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reason" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "PurchaseOrderChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderChangeRequest_purchaseOrderId_status_idx" ON "PurchaseOrderChangeRequest"("purchaseOrderId", "status");
CREATE INDEX "PurchaseOrderChangeRequest_businessId_createdAt_idx" ON "PurchaseOrderChangeRequest"("businessId", "createdAt");

ALTER TABLE "PurchaseOrderChangeRequest" ADD CONSTRAINT "PurchaseOrderChangeRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderChangeRequest" ADD CONSTRAINT "PurchaseOrderChangeRequest_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderChangeRequest" ADD CONSTRAINT "PurchaseOrderChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderChangeRequest" ADD CONSTRAINT "PurchaseOrderChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
