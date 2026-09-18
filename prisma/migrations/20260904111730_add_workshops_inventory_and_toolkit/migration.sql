-- CreateEnum
CREATE TYPE "WorkshopStaffPosition" AS ENUM ('WORKSHOP_MANAGER', 'STOREKEEPER', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "WorkshopStoreType" AS ENUM ('GENERAL', 'TOOLS', 'SPARE_PARTS', 'CONSUMABLES');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('OPENING_BALANCE', 'RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "ToolCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'UNSERVICEABLE');

-- CreateEnum
CREATE TYPE "ToolAssetStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ISSUED', 'IN_USE', 'UNDER_REPAIR', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "ToolCustodyAction" AS ENUM ('RECEIVED', 'ISSUED', 'RETURNED', 'TRANSFERRED', 'AUDITED', 'SENT_FOR_REPAIR', 'RETIRED', 'REPORTED_LOST');

-- CreateTable
CREATE TABLE "MaintenanceWorkshop" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "administrativeUnitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceWorkshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopStaffAssignment" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" "WorkshopStaffPosition" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopStore" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkshopStoreType" NOT NULL DEFAULT 'GENERAL',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'each',
    "manufacturerPartNumber" TEXT,
    "refrigerantCompatibility" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "quantityOnHand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "quantityReserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "lastCountedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,2),
    "referenceNumber" TEXT,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolCatalogItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "specification" TEXT,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'each',
    "expectedUsefulLifeYears" INTEGER,
    "defaultAuditIntervalMonths" INTEGER,
    "calibrationRequired" BOOLEAN NOT NULL DEFAULT false,
    "qualityStandard" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopKitTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceDocument" TEXT,
    "refrigerantSystems" TEXT[],
    "expectedUsefulLifeYears" INTEGER,
    "defaultAuditIntervalMonths" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopKitTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopKitItem" (
    "id" TEXT NOT NULL,
    "kitTemplateId" TEXT NOT NULL,
    "toolCatalogItemId" TEXT NOT NULL,
    "requiredQuantity" INTEGER NOT NULL DEFAULT 1,
    "packContents" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopKitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopKitAssignment" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "kitTemplateId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopKitAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolAsset" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "toolCatalogItemId" TEXT NOT NULL,
    "currentCustodianId" TEXT,
    "assetTag" TEXT NOT NULL,
    "serialNumber" TEXT,
    "condition" "ToolCondition" NOT NULL DEFAULT 'NEW',
    "status" "ToolAssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "acquiredAt" TIMESTAMP(3),
    "lastAuditedAt" TIMESTAMP(3),
    "nextAuditDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolCustodyEvent" (
    "id" TEXT NOT NULL,
    "toolAssetId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "action" "ToolCustodyAction" NOT NULL,
    "custodianId" TEXT,
    "condition" "ToolCondition" NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolCustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceWorkshop_administrativeUnitId_status_idx" ON "MaintenanceWorkshop"("administrativeUnitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkshop_organizationId_code_key" ON "MaintenanceWorkshop"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WorkshopStaffAssignment_userId_status_idx" ON "WorkshopStaffAssignment"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkshopStaffAssignment_workshopId_position_status_idx" ON "WorkshopStaffAssignment"("workshopId", "position", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopStaffAssignment_workshopId_userId_position_key" ON "WorkshopStaffAssignment"("workshopId", "userId", "position");

-- CreateIndex
CREATE INDEX "WorkshopStore_workshopId_status_idx" ON "WorkshopStore"("workshopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopStore_workshopId_code_key" ON "WorkshopStore"("workshopId", "code");

-- CreateIndex
CREATE INDEX "SparePart_organizationId_category_status_idx" ON "SparePart"("organizationId", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_organizationId_code_key" ON "SparePart"("organizationId", "code");

-- CreateIndex
CREATE INDEX "StockBalance_sparePartId_idx" ON "StockBalance"("sparePartId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_storeId_sparePartId_key" ON "StockBalance"("storeId", "sparePartId");

-- CreateIndex
CREATE INDEX "InventoryMovement_storeId_occurredAt_idx" ON "InventoryMovement"("storeId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_sparePartId_occurredAt_idx" ON "InventoryMovement"("sparePartId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_recordedById_occurredAt_idx" ON "InventoryMovement"("recordedById", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_referenceNumber_idx" ON "InventoryMovement"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCatalogItem_code_key" ON "ToolCatalogItem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCatalogItem_name_key" ON "ToolCatalogItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopKitTemplate_code_key" ON "WorkshopKitTemplate"("code");

-- CreateIndex
CREATE INDEX "WorkshopKitItem_toolCatalogItemId_idx" ON "WorkshopKitItem"("toolCatalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopKitItem_kitTemplateId_toolCatalogItemId_key" ON "WorkshopKitItem"("kitTemplateId", "toolCatalogItemId");

-- CreateIndex
CREATE INDEX "WorkshopKitAssignment_kitTemplateId_status_idx" ON "WorkshopKitAssignment"("kitTemplateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopKitAssignment_workshopId_kitTemplateId_key" ON "WorkshopKitAssignment"("workshopId", "kitTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolAsset_assetTag_key" ON "ToolAsset"("assetTag");

-- CreateIndex
CREATE INDEX "ToolAsset_storeId_status_idx" ON "ToolAsset"("storeId", "status");

-- CreateIndex
CREATE INDEX "ToolAsset_toolCatalogItemId_condition_idx" ON "ToolAsset"("toolCatalogItemId", "condition");

-- CreateIndex
CREATE INDEX "ToolAsset_currentCustodianId_status_idx" ON "ToolAsset"("currentCustodianId", "status");

-- CreateIndex
CREATE INDEX "ToolCustodyEvent_toolAssetId_occurredAt_idx" ON "ToolCustodyEvent"("toolAssetId", "occurredAt");

-- CreateIndex
CREATE INDEX "ToolCustodyEvent_recordedById_occurredAt_idx" ON "ToolCustodyEvent"("recordedById", "occurredAt");

-- CreateIndex
CREATE INDEX "ToolCustodyEvent_custodianId_occurredAt_idx" ON "ToolCustodyEvent"("custodianId", "occurredAt");

-- AddForeignKey
ALTER TABLE "MaintenanceWorkshop" ADD CONSTRAINT "MaintenanceWorkshop_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkshop" ADD CONSTRAINT "MaintenanceWorkshop_administrativeUnitId_fkey" FOREIGN KEY ("administrativeUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopStaffAssignment" ADD CONSTRAINT "WorkshopStaffAssignment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "MaintenanceWorkshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopStaffAssignment" ADD CONSTRAINT "WorkshopStaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopStore" ADD CONSTRAINT "WorkshopStore_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "MaintenanceWorkshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "WorkshopStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "WorkshopStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopKitItem" ADD CONSTRAINT "WorkshopKitItem_kitTemplateId_fkey" FOREIGN KEY ("kitTemplateId") REFERENCES "WorkshopKitTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopKitItem" ADD CONSTRAINT "WorkshopKitItem_toolCatalogItemId_fkey" FOREIGN KEY ("toolCatalogItemId") REFERENCES "ToolCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopKitAssignment" ADD CONSTRAINT "WorkshopKitAssignment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "MaintenanceWorkshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopKitAssignment" ADD CONSTRAINT "WorkshopKitAssignment_kitTemplateId_fkey" FOREIGN KEY ("kitTemplateId") REFERENCES "WorkshopKitTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolAsset" ADD CONSTRAINT "ToolAsset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "WorkshopStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolAsset" ADD CONSTRAINT "ToolAsset_toolCatalogItemId_fkey" FOREIGN KEY ("toolCatalogItemId") REFERENCES "ToolCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolAsset" ADD CONSTRAINT "ToolAsset_currentCustodianId_fkey" FOREIGN KEY ("currentCustodianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCustodyEvent" ADD CONSTRAINT "ToolCustodyEvent_toolAssetId_fkey" FOREIGN KEY ("toolAssetId") REFERENCES "ToolAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCustodyEvent" ADD CONSTRAINT "ToolCustodyEvent_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCustodyEvent" ADD CONSTRAINT "ToolCustodyEvent_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
