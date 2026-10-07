CREATE TYPE "WorkOrderRequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'FUNDED', 'DEFERRED', 'CLOSED');
CREATE TYPE "WorkOrderFundingStatus" AS ENUM ('PENDING', 'APPROVED', 'DEFERRED', 'REJECTED');

CREATE TABLE "MonthlyWorkOrderRequisition" (
    "id" TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "administrativeUnitId" TEXT,
    "workshopId" TEXT,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "status" "WorkOrderRequisitionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "totalEstimatedCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "carriedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlyWorkOrderRequisition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyWorkOrderRequisitionItem" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "estimatedCost" DECIMAL(14,2) NOT NULL,
    "approvedAmount" DECIMAL(14,2),
    "fundingStatus" "WorkOrderFundingStatus" NOT NULL DEFAULT 'PENDING',
    "sourceItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlyWorkOrderRequisitionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyWorkOrderRequisition_requisitionNumber_key" ON "MonthlyWorkOrderRequisition"("requisitionNumber");
CREATE INDEX "MonthlyWorkOrderRequisition_organizationId_periodMonth_status_idx" ON "MonthlyWorkOrderRequisition"("organizationId", "periodMonth", "status");
CREATE INDEX "MonthlyWorkOrderRequisition_administrativeUnitId_periodMonth_idx" ON "MonthlyWorkOrderRequisition"("administrativeUnitId", "periodMonth");
CREATE INDEX "MonthlyWorkOrderRequisition_workshopId_periodMonth_idx" ON "MonthlyWorkOrderRequisition"("workshopId", "periodMonth");
CREATE INDEX "MonthlyWorkOrderRequisition_submittedById_periodMonth_idx" ON "MonthlyWorkOrderRequisition"("submittedById", "periodMonth");
CREATE UNIQUE INDEX "MonthlyWorkOrderRequisitionItem_requisitionId_workOrderId_key" ON "MonthlyWorkOrderRequisitionItem"("requisitionId", "workOrderId");
CREATE INDEX "MonthlyWorkOrderRequisitionItem_workOrderId_fundingStatus_idx" ON "MonthlyWorkOrderRequisitionItem"("workOrderId", "fundingStatus");

ALTER TABLE "MonthlyWorkOrderRequisitionItem" ADD CONSTRAINT "MonthlyWorkOrderRequisitionItem_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "MonthlyWorkOrderRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyWorkOrderRequisitionItem" ADD CONSTRAINT "MonthlyWorkOrderRequisitionItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
