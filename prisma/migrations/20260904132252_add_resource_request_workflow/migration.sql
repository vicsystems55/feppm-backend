-- CreateEnum
CREATE TYPE "ResourceRequestStatus" AS ENUM ('SUBMITTED', 'WORKSHOP_APPROVED', 'AWAITING_STOCK', 'APPROVED_FOR_ISSUE', 'PARTIALLY_ISSUED', 'ISSUED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResourceRequestItemType" AS ENUM ('TOOL', 'SPARE_PART');

-- CreateEnum
CREATE TYPE "ResourceRequestUrgency" AS ENUM ('ROUTINE', 'URGENT', 'CRITICAL');

-- CreateTable
CREATE TABLE "ResourceRequestSequence" (
    "year" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceRequestSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "ResourceRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "workshopReviewedById" TEXT,
    "storeReviewedById" TEXT,
    "urgency" "ResourceRequestUrgency" NOT NULL DEFAULT 'ROUTINE',
    "status" "ResourceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "purpose" TEXT NOT NULL,
    "workshopReviewNote" TEXT,
    "storeReviewNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workshopReviewedAt" TIMESTAMP(3),
    "storeReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequestItem" (
    "id" TEXT NOT NULL,
    "resourceRequestId" TEXT NOT NULL,
    "itemType" "ResourceRequestItemType" NOT NULL,
    "toolCatalogItemId" TEXT,
    "sparePartId" TEXT,
    "requestedQuantity" DECIMAL(14,3) NOT NULL,
    "approvedQuantity" DECIMAL(14,3),
    "issuedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "returnedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "consumedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequestActivity" (
    "id" TEXT NOT NULL,
    "resourceRequestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "ResourceRequestStatus",
    "toStatus" "ResourceRequestStatus",
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceRequestActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResourceRequest_requestNumber_key" ON "ResourceRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "ResourceRequest_organizationId_status_requestedAt_idx" ON "ResourceRequest"("organizationId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "ResourceRequest_workshopId_status_requestedAt_idx" ON "ResourceRequest"("workshopId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "ResourceRequest_workOrderId_idx" ON "ResourceRequest"("workOrderId");

-- CreateIndex
CREATE INDEX "ResourceRequest_requestedById_status_idx" ON "ResourceRequest"("requestedById", "status");

-- CreateIndex
CREATE INDEX "ResourceRequestItem_resourceRequestId_itemType_idx" ON "ResourceRequestItem"("resourceRequestId", "itemType");

-- CreateIndex
CREATE INDEX "ResourceRequestItem_toolCatalogItemId_idx" ON "ResourceRequestItem"("toolCatalogItemId");

-- CreateIndex
CREATE INDEX "ResourceRequestItem_sparePartId_idx" ON "ResourceRequestItem"("sparePartId");

-- CreateIndex
CREATE INDEX "ResourceRequestActivity_resourceRequestId_createdAt_idx" ON "ResourceRequestActivity"("resourceRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceRequestActivity_actorId_createdAt_idx" ON "ResourceRequestActivity"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "MaintenanceWorkshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_workshopReviewedById_fkey" FOREIGN KEY ("workshopReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_storeReviewedById_fkey" FOREIGN KEY ("storeReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestItem" ADD CONSTRAINT "ResourceRequestItem_resourceRequestId_fkey" FOREIGN KEY ("resourceRequestId") REFERENCES "ResourceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestItem" ADD CONSTRAINT "ResourceRequestItem_toolCatalogItemId_fkey" FOREIGN KEY ("toolCatalogItemId") REFERENCES "ToolCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestItem" ADD CONSTRAINT "ResourceRequestItem_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestActivity" ADD CONSTRAINT "ResourceRequestActivity_resourceRequestId_fkey" FOREIGN KEY ("resourceRequestId") REFERENCES "ResourceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestActivity" ADD CONSTRAINT "ResourceRequestActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
