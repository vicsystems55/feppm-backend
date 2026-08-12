-- CreateEnum
CREATE TYPE "MaintenanceWorkerType" AS ENUM ('GOVERNMENT', 'VENDOR', 'PARTNER');
CREATE TYPE "TechnicianAvailabilityStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'ON_LEAVE', 'INACTIVE');
CREATE TYPE "MaintenanceTriageDecision" AS ENUM ('INFORMATION_REQUIRED', 'REMOTE_SUPPORT', 'FIELD_VISIT', 'VENDOR_REFERRAL', 'PARTS_REQUIRED', 'REPLACEMENT_RECOMMENDED', 'NO_ACTION');
CREATE TYPE "MaintenanceWorkOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'AWAITING_VERIFICATION', 'COMPLETED', 'CANCELLED');
CREATE TYPE "VendorContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED');
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "MaintenanceSkill" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceSkill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicianProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "baseAdministrativeUnitId" TEXT,
  "vendorId" TEXT,
  "workerType" "MaintenanceWorkerType" NOT NULL DEFAULT 'GOVERNMENT',
  "jobTitle" TEXT,
  "yearsExperience" INTEGER,
  "cvUrl" TEXT,
  "availabilityStatus" "TechnicianAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TechnicianProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicianSkill" (
  "technicianProfileId" TEXT NOT NULL,
  "maintenanceSkillId" TEXT NOT NULL,
  "proficiencyLevel" TEXT,
  "certified" BOOLEAN NOT NULL DEFAULT false,
  "certificationExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicianSkill_pkey" PRIMARY KEY ("technicianProfileId", "maintenanceSkillId")
);

CREATE TABLE "VendorContract" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "contractNumber" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "serviceDescription" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "responseTargetHours" INTEGER,
  "spendingLimit" DECIMAL(14,2),
  "status" "VendorContractStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VendorContractFacility" (
  "vendorContractId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorContractFacility_pkey" PRIMARY KEY ("vendorContractId", "facilityId")
);

CREATE TABLE "VendorContractEquipmentType" (
  "vendorContractId" TEXT NOT NULL,
  "equipmentTypeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorContractEquipmentType_pkey" PRIMARY KEY ("vendorContractId", "equipmentTypeId")
);

CREATE TABLE "MaintenanceTriage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "decision" "MaintenanceTriageDecision" NOT NULL,
  "assessment" TEXT NOT NULL,
  "recommendedAction" TEXT,
  "safetyRisk" BOOLEAN NOT NULL DEFAULT false,
  "vaccineRisk" BOOLEAN NOT NULL DEFAULT false,
  "remoteResolutionPossible" BOOLEAN NOT NULL DEFAULT false,
  "triagedById" TEXT NOT NULL,
  "triagedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceTriage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceWorkOrder" (
  "id" TEXT NOT NULL,
  "workOrderNumber" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "triageId" TEXT,
  "organizationId" TEXT NOT NULL,
  "administrativeUnitId" TEXT,
  "facilityId" TEXT,
  "equipmentId" TEXT,
  "assignedTechnicianId" TEXT,
  "vendorContractId" TEXT,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 3,
  "status" "MaintenanceWorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "plannedStartAt" TIMESTAMP(3),
  "plannedEndAt" TIMESTAMP(3),
  "estimatedCost" DECIMAL(14,2),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceWorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkOrderSequence" (
  "year" INTEGER NOT NULL,
  "currentValue" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrderSequence_pkey" PRIMARY KEY ("year")
);

CREATE TABLE "OutboxEvent" (
  "id" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "lastError" TEXT,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceSkill_code_key" ON "MaintenanceSkill"("code");
CREATE UNIQUE INDEX "MaintenanceSkill_name_key" ON "MaintenanceSkill"("name");
CREATE UNIQUE INDEX "TechnicianProfile_userId_key" ON "TechnicianProfile"("userId");
CREATE INDEX "TechnicianProfile_organizationId_availabilityStatus_idx" ON "TechnicianProfile"("organizationId", "availabilityStatus");
CREATE INDEX "TechnicianProfile_baseAdministrativeUnitId_status_idx" ON "TechnicianProfile"("baseAdministrativeUnitId", "status");
CREATE INDEX "TechnicianProfile_vendorId_status_idx" ON "TechnicianProfile"("vendorId", "status");
CREATE INDEX "TechnicianSkill_maintenanceSkillId_idx" ON "TechnicianSkill"("maintenanceSkillId");
CREATE UNIQUE INDEX "VendorContract_contractNumber_key" ON "VendorContract"("contractNumber");
CREATE INDEX "VendorContract_organizationId_status_idx" ON "VendorContract"("organizationId", "status");
CREATE INDEX "VendorContract_vendorId_status_idx" ON "VendorContract"("vendorId", "status");
CREATE INDEX "VendorContractFacility_facilityId_idx" ON "VendorContractFacility"("facilityId");
CREATE INDEX "VendorContractEquipmentType_equipmentTypeId_idx" ON "VendorContractEquipmentType"("equipmentTypeId");
CREATE UNIQUE INDEX "MaintenanceTriage_ticketId_key" ON "MaintenanceTriage"("ticketId");
CREATE INDEX "MaintenanceTriage_decision_triagedAt_idx" ON "MaintenanceTriage"("decision", "triagedAt");
CREATE UNIQUE INDEX "MaintenanceWorkOrder_workOrderNumber_key" ON "MaintenanceWorkOrder"("workOrderNumber");
CREATE INDEX "MaintenanceWorkOrder_organizationId_status_idx" ON "MaintenanceWorkOrder"("organizationId", "status");
CREATE INDEX "MaintenanceWorkOrder_administrativeUnitId_status_idx" ON "MaintenanceWorkOrder"("administrativeUnitId", "status");
CREATE INDEX "MaintenanceWorkOrder_facilityId_status_idx" ON "MaintenanceWorkOrder"("facilityId", "status");
CREATE INDEX "MaintenanceWorkOrder_assignedTechnicianId_status_idx" ON "MaintenanceWorkOrder"("assignedTechnicianId", "status");
CREATE INDEX "MaintenanceWorkOrder_vendorContractId_status_idx" ON "MaintenanceWorkOrder"("vendorContractId", "status");
CREATE INDEX "MaintenanceWorkOrder_ticketId_idx" ON "MaintenanceWorkOrder"("ticketId");
CREATE INDEX "OutboxEvent_status_occurredAt_idx" ON "OutboxEvent"("status", "occurredAt");
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_occurredAt_idx" ON "OutboxEvent"("aggregateType", "aggregateId", "occurredAt");

-- AddForeignKey
ALTER TABLE "TechnicianProfile" ADD CONSTRAINT "TechnicianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicianProfile" ADD CONSTRAINT "TechnicianProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicianProfile" ADD CONSTRAINT "TechnicianProfile_baseAdministrativeUnitId_fkey" FOREIGN KEY ("baseAdministrativeUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TechnicianProfile" ADD CONSTRAINT "TechnicianProfile_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TechnicianSkill" ADD CONSTRAINT "TechnicianSkill_technicianProfileId_fkey" FOREIGN KEY ("technicianProfileId") REFERENCES "TechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicianSkill" ADD CONSTRAINT "TechnicianSkill_maintenanceSkillId_fkey" FOREIGN KEY ("maintenanceSkillId") REFERENCES "MaintenanceSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorContract" ADD CONSTRAINT "VendorContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorContract" ADD CONSTRAINT "VendorContract_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorContract" ADD CONSTRAINT "VendorContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorContractFacility" ADD CONSTRAINT "VendorContractFacility_vendorContractId_fkey" FOREIGN KEY ("vendorContractId") REFERENCES "VendorContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorContractFacility" ADD CONSTRAINT "VendorContractFacility_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorContractEquipmentType" ADD CONSTRAINT "VendorContractEquipmentType_vendorContractId_fkey" FOREIGN KEY ("vendorContractId") REFERENCES "VendorContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorContractEquipmentType" ADD CONSTRAINT "VendorContractEquipmentType_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTriage" ADD CONSTRAINT "MaintenanceTriage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTriage" ADD CONSTRAINT "MaintenanceTriage_triagedById_fkey" FOREIGN KEY ("triagedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_triageId_fkey" FOREIGN KEY ("triageId") REFERENCES "MaintenanceTriage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_administrativeUnitId_fkey" FOREIGN KEY ("administrativeUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "TechnicianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_vendorContractId_fkey" FOREIGN KEY ("vendorContractId") REFERENCES "VendorContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Portable PostgreSQL event outbox. Delivery to Supabase Realtime, Firebase, email,
-- or other channels is deliberately handled outside this trigger.
CREATE OR REPLACE FUNCTION feppm_capture_maintenance_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  record_data jsonb;
  record_id text;
BEGIN
  record_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  record_id := record_data ->> 'id';
  EXECUTE format(
    'INSERT INTO %I."OutboxEvent" ("id", "aggregateType", "aggregateId", "eventType", "payload", "occurredAt") VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
    TG_TABLE_SCHEMA
  ) USING
    'evt_' || md5(random()::text || clock_timestamp()::text || record_id),
    TG_TABLE_NAME,
    record_id,
    upper(TG_TABLE_NAME || '_' || TG_OP),
    jsonb_build_object('operation', TG_OP, 'record', record_data);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "MaintenanceTriage_outbox_trigger"
AFTER INSERT OR UPDATE ON "MaintenanceTriage"
FOR EACH ROW EXECUTE FUNCTION feppm_capture_maintenance_event();

CREATE TRIGGER "MaintenanceWorkOrder_outbox_trigger"
AFTER INSERT OR UPDATE ON "MaintenanceWorkOrder"
FOR EACH ROW EXECUTE FUNCTION feppm_capture_maintenance_event();
