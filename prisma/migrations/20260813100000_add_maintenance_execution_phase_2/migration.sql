-- CreateEnum
CREATE TYPE "WorkOrderEvidenceCategory" AS ENUM ('ARRIVAL', 'BEFORE_REPAIR', 'DURING_REPAIR', 'AFTER_REPAIR', 'PART_USED', 'OTHER');
CREATE TYPE "WorkOrderPartSource" AS ENUM ('STATE_STORE', 'LOCAL_PURCHASE', 'VENDOR', 'TECHNICIAN_STOCK', 'OTHER');

-- AlterTable
ALTER TABLE "MaintenanceWorkOrder"
  ADD COLUMN "actualCost" DECIMAL(14,2),
  ADD COLUMN "approvalNote" TEXT,
  ADD COLUMN "verificationNote" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completionSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MaintenanceWorkOrderActivity" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" "MaintenanceWorkOrderStatus",
  "toStatus" "MaintenanceWorkOrderStatus",
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceWorkOrderActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkOrderFieldReport" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "arrivedAt" TIMESTAMP(3),
  "departedAt" TIMESTAMP(3),
  "staffPresentCount" INTEGER NOT NULL DEFAULT 0,
  "staffSupportCount" INTEGER NOT NULL DEFAULT 0,
  "diagnosis" TEXT,
  "rootCause" TEXT,
  "actionTaken" TEXT,
  "observation" TEXT,
  "repairOutcome" TEXT,
  "equipmentStatusAfterRepair" "EquipmentFunctionalityStatus",
  "laborMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrderFieldReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkOrderPartUsage" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "partName" TEXT NOT NULL,
  "partNumber" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(14,2),
  "totalCost" DECIMAL(14,2),
  "source" "WorkOrderPartSource" NOT NULL DEFAULT 'OTHER',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrderPartUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkOrderEvidence" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "category" "WorkOrderEvidenceCategory" NOT NULL DEFAULT 'OTHER',
  "fileUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "caption" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkOrderEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrderActivity_workOrderId_createdAt_idx" ON "MaintenanceWorkOrderActivity"("workOrderId", "createdAt");
CREATE INDEX "MaintenanceWorkOrderActivity_actorId_createdAt_idx" ON "MaintenanceWorkOrderActivity"("actorId", "createdAt");
CREATE UNIQUE INDEX "WorkOrderFieldReport_workOrderId_key" ON "WorkOrderFieldReport"("workOrderId");
CREATE INDEX "WorkOrderFieldReport_submittedById_updatedAt_idx" ON "WorkOrderFieldReport"("submittedById", "updatedAt");
CREATE INDEX "WorkOrderPartUsage_workOrderId_createdAt_idx" ON "WorkOrderPartUsage"("workOrderId", "createdAt");
CREATE INDEX "WorkOrderEvidence_workOrderId_createdAt_idx" ON "WorkOrderEvidence"("workOrderId", "createdAt");
CREATE INDEX "WorkOrderEvidence_uploadedById_createdAt_idx" ON "WorkOrderEvidence"("uploadedById", "createdAt");

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrderActivity" ADD CONSTRAINT "MaintenanceWorkOrderActivity_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrderActivity" ADD CONSTRAINT "MaintenanceWorkOrderActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderFieldReport" ADD CONSTRAINT "WorkOrderFieldReport_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderFieldReport" ADD CONSTRAINT "WorkOrderFieldReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderPartUsage" ADD CONSTRAINT "WorkOrderPartUsage_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderEvidence" ADD CONSTRAINT "WorkOrderEvidence_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderEvidence" ADD CONSTRAINT "WorkOrderEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
