-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('GOVERNMENT', 'NGO', 'PRIVATE', 'DONOR', 'RESEARCH', 'VENDOR', 'OTHER');

-- CreateEnum
CREATE TYPE "AdministrativeUnitType" AS ENUM ('NATIONAL', 'ZONE', 'REGION', 'STATE', 'LGA', 'DISTRICT', 'WARD', 'OTHER');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('PRIMARY_HEALTH_CENTRE', 'GENERAL_HOSPITAL', 'TEACHING_HOSPITAL', 'SPECIALIST_HOSPITAL', 'LABORATORY', 'WAREHOUSE', 'HEALTH_POST', 'OTHER');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('FEDERAL', 'STATE', 'LGA', 'PUBLIC', 'PRIVATE', 'NGO', 'FAITH_BASED', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentFunctionalityStatus" AS ENUM ('FUNCTIONAL', 'PARTIALLY_FUNCTIONAL', 'NON_FUNCTIONAL', 'UNDER_REPAIR', 'DECOMMISSIONED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EquipmentConditionStatus" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EvidenceRequirement" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');

-- CreateEnum
CREATE TYPE "ChecklistInputType" AS ENUM ('CHECKBOX', 'YES_NO', 'PASS_FAIL', 'NUMBER', 'TEMPERATURE', 'HUMIDITY', 'DATE', 'TIME', 'SHORT_TEXT', 'LONG_TEXT', 'DROPDOWN', 'MULTI_SELECT', 'PHOTO', 'MULTIPLE_PHOTOS', 'SIGNATURE', 'GPS_CONFIRMATION');

-- CreateEnum
CREATE TYPE "FrequencyType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SIX_MONTHLY', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('UPCOMING', 'DUE', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED_ON_TIME', 'COMPLETED_LATE', 'OVERDUE', 'MISSED', 'WAIVED', 'NOT_APPLICABLE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompletionClassification" AS ENUM ('ON_TIME', 'WITHIN_GRACE_PERIOD', 'LATE', 'MISSED', 'WAIVED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR', 'ESCALATED', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED', 'CANCELLED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "TicketSourceType" AS ENUM ('FAILED_CHECKLIST', 'ABNORMAL_READING', 'USER_REPORT', 'SUPERVISOR_OBSERVATION', 'SCHEDULED_INSPECTION', 'SYSTEM_ALERT');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('INCIDENT', 'SERVICE_REQUEST', 'COMPLAINT', 'SUGGESTION', 'TECHNICAL_SUPPORT');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('EQUIPMENT_FAULT', 'MAINTENANCE', 'TEMPERATURE_SAFETY', 'CHECKLIST', 'INVENTORY', 'ACCESS_ACCOUNT', 'DATA_QUALITY', 'COMPLAINT', 'SUGGESTION', 'TECHNICAL_SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketEscalationLevel" AS ENUM ('FACILITY', 'LGA', 'STATE', 'ZONE', 'NATIONAL', 'PLATFORM');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "RewardTransactionType" AS ENUM ('CREDIT', 'PENALTY', 'REDEMPTION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PilotGroupType" AS ENUM ('INTERVENTION', 'COMPARISON', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('BASELINE', 'MONTHLY', 'MIDLINE', 'ENDLINE', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ASSIGNED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isoCode" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "currencyCode" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "OrganizationType" NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdministrativeUnit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "AdministrativeUnitType" NOT NULL,
    "timezone" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdministrativeUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "administrativeUnitId" TEXT NOT NULL,
    "managerUserId" TEXT,
    "name" TEXT NOT NULL,
    "facilityCode" TEXT,
    "facilityType" "FacilityType" NOT NULL,
    "ownershipType" "OwnershipType",
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 250,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityContact" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "contactKey" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "phone" TEXT,
    "normalizedPhone" TEXT,
    "isPhoneValid" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "sourceRowNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityDepartment" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "managerUserId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "facilityId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserScope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "administrativeUnitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "expectedUsefulLifeYears" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentModel" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "technicalSpecs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "departmentId" TEXT,
    "equipmentTypeId" TEXT NOT NULL,
    "equipmentModelId" TEXT,
    "vendorId" TEXT,
    "assetCode" TEXT NOT NULL,
    "serialNumber" TEXT,
    "yearOfManufacture" INTEGER,
    "installationDate" TIMESTAMP(3),
    "commissioningDate" TIMESTAMP(3),
    "powerSource" TEXT,
    "grossVolumeLitres" DECIMAL(10,2),
    "netVolumeLitres" DECIMAL(10,2),
    "hasAlarmSystem" BOOLEAN,
    "hasAdequateShelves" BOOLEAN,
    "hasCurtain" BOOLEAN,
    "downtimeMonths" INTEGER,
    "nonFunctionalReason" TEXT,
    "coolingUnitCount" INTEGER,
    "hasContinuousTemperatureMonitor" BOOLEAN,
    "hasBuiltInThermometer" BOOLEAN,
    "fundingSource" TEXT,
    "repairHistory" TEXT,
    "underWarranty" BOOLEAN,
    "source" TEXT,
    "sourceRowNumber" INTEGER,
    "functionalityStatus" "EquipmentFunctionalityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "conditionStatus" "EquipmentConditionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "warrantyStartDate" TIMESTAMP(3),
    "warrantyEndDate" TIMESTAMP(3),
    "expectedEndOfLife" TIMESTAMP(3),
    "purchaseCost" DECIMAL(14,2),
    "replacementCost" DECIMAL(14,2),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentStatusHistory" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "previousStatus" "EquipmentFunctionalityStatus",
    "newStatus" "EquipmentFunctionalityStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentDocument" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sop" (
    "id" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SopResource" (
    "id" TEXT NOT NULL,
    "sopId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "resourceUrl" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SopResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    "sopId" TEXT,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "frequencyType" "FrequencyType" NOT NULL,
    "customCronExpression" TEXT,
    "estimatedDurationMinutes" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistTemplateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instruction" TEXT,
    "correctiveAction" TEXT,
    "inputType" "ChecklistInputType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "evidenceRequirement" "EvidenceRequirement" NOT NULL DEFAULT 'NONE',
    "technicianOnly" BOOLEAN NOT NULL DEFAULT false,
    "sequenceOrder" INTEGER NOT NULL,
    "weight" DECIMAL(5,2),
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItemOption" (
    "id" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,

    CONSTRAINT "ChecklistItemOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistRule" (
    "id" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "thresholdMin" DECIMAL(14,4),
    "thresholdMax" DECIMAL(14,4),
    "expectedValue" TEXT,
    "resultStatus" TEXT,
    "severity" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "createAlert" BOOLEAN NOT NULL DEFAULT false,
    "createTicket" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceSchedule" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "checklistTemplateId" TEXT NOT NULL,
    "assignedRoleId" TEXT,
    "assignedUserId" TEXT,
    "frequencyType" "FrequencyType" NOT NULL,
    "customCronExpression" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueTime" TEXT,
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceTask" (
    "id" TEXT NOT NULL,
    "maintenanceScheduleId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "completedById" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "overdueAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'UPCOMING',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionClassification" "CompletionClassification",
    "complianceScore" DECIMAL(5,2),
    "submittedOffline" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskItemResponse" (
    "id" TEXT NOT NULL,
    "maintenanceTaskId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "responseBoolean" BOOLEAN,
    "responseNumber" DECIMAL(14,4),
    "responseText" TEXT,
    "responseOptionId" TEXT,
    "passed" BOOLEAN,
    "comment" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskItemResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisteredDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceIdentifier" TEXT NOT NULL,
    "deviceModel" TEXT,
    "platform" TEXT,
    "appVersion" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisteredDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFile" (
    "id" TEXT NOT NULL,
    "maintenanceTaskId" TEXT,
    "taskItemResponseId" TEXT,
    "equipmentId" TEXT,
    "facilityId" TEXT,
    "userId" TEXT NOT NULL,
    "registeredDeviceId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileHash" TEXT,
    "capturedAtDevice" TIMESTAMP(3) NOT NULL,
    "receivedAtServer" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "gpsAccuracy" DECIMAL(10,2),
    "distanceFromFacilityMeters" DECIMAL(12,2),
    "capturedOffline" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "suspiciousFlag" BOOLEAN NOT NULL DEFAULT false,
    "watermarkData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT,
    "equipmentId" TEXT,
    "maintenanceTaskId" TEXT,
    "ticketId" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" "RiskLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRecipient" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveryChannel" "DeliveryChannel" NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "administrativeUnitId" TEXT,
    "equipmentId" TEXT,
    "facilityId" TEXT,
    "maintenanceTaskId" TEXT,
    "reportedById" TEXT NOT NULL,
    "assignedTechnicianId" TEXT,
    "type" "TicketType" NOT NULL DEFAULT 'INCIDENT',
    "category" "TicketCategory" NOT NULL DEFAULT 'EQUIPMENT_FAULT',
    "sourceType" "TicketSourceType" NOT NULL,
    "sourceId" TEXT,
    "clientRequestId" TEXT,
    "title" TEXT NOT NULL,
    "faultDescription" TEXT NOT NULL,
    "impact" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "urgency" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "severity" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "escalationLevel" "TicketEscalationLevel" NOT NULL DEFAULT 'FACILITY',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "responseDueAt" TIMESTAMP(3),
    "resolutionDueAt" TIMESTAMP(3),
    "slaPausedAt" TIMESTAMP(3),
    "totalPausedMinutes" INTEGER NOT NULL DEFAULT 0,
    "workStartedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "resolutionSummary" TEXT,
    "downtimeMinutes" INTEGER,
    "estimatedCost" DECIMAL(14,2),
    "actualCost" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketActivity" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "oldStatus" "TicketStatus",
    "newStatus" "TicketStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "commentId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAssignment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "reason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "TicketAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEscalation" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromLevel" "TicketEscalationLevel" NOT NULL,
    "toLevel" "TicketEscalationLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "escalatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSequence" (
    "year" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "TicketDiagnosis" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "rootCause" TEXT,
    "recommendedAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketRepair" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "repairOutcome" TEXT,
    "equipmentStatusAfterRepair" "EquipmentFunctionalityStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketRepair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPart" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(14,2),
    "totalCost" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceSnapshot" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "tasksDue" INTEGER NOT NULL,
    "tasksCompleted" INTEGER NOT NULL,
    "tasksCompletedOnTime" INTEGER NOT NULL,
    "tasksCompletedLate" INTEGER NOT NULL,
    "tasksMissed" INTEGER NOT NULL,
    "compliancePercentage" DECIMAL(5,2) NOT NULL,
    "completionPercentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentPerformanceMetric" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "uptimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "downtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "repeatFailureCount" INTEGER NOT NULL DEFAULT 0,
    "maintenanceCount" INTEGER NOT NULL DEFAULT 0,
    "meanTimeBetweenFailures" DECIMAL(14,2),
    "meanTimeToRepair" DECIMAL(14,2),
    "healthScore" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentPerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "simulatedDatetime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "speedMultiplier" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationEvent" (
    "id" TEXT NOT NULL,
    "simulationSessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minimumCredits" INTEGER NOT NULL,
    "maximumCredits" INTEGER,
    "benefits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentLevelId" TEXT,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "lifetimeCredits" INTEGER NOT NULL DEFAULT 0,
    "currentStreakDays" INTEGER NOT NULL DEFAULT 0,
    "longestStreakDays" INTEGER NOT NULL DEFAULT 0,
    "lastStreakDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRule" (
    "id" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "creditValue" INTEGER NOT NULL DEFAULT 0,
    "penaltyValue" INTEGER NOT NULL DEFAULT 0,
    "dailyLimit" INTEGER,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardTransaction" (
    "id" TEXT NOT NULL,
    "rewardAccountId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "credits" INTEGER NOT NULL,
    "transactionType" "RewardTransactionType" NOT NULL,
    "description" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("userId","badgeId")
);

-- CreateTable
CREATE TABLE "RewardCatalogue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creditCost" INTEGER NOT NULL,
    "stockCount" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardCatalogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "rewardAccountId" TEXT NOT NULL,
    "rewardCatalogueId" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "status" "RewardRedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCourse" (
    "id" TEXT NOT NULL,
    "equipmentTypeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "courseType" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "content" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progress" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partnership" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "organizationName" TEXT NOT NULL,
    "partnerType" TEXT NOT NULL,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "agreementStart" TIMESTAMP(3),
    "agreementEnd" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT,
    "equipmentId" TEXT,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotProject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pilotStage" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotFacility" (
    "id" TEXT NOT NULL,
    "pilotProjectId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "groupType" "PilotGroupType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactIndicator" (
    "id" TEXT NOT NULL,
    "pilotProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "indicatorType" TEXT NOT NULL,
    "unit" TEXT,
    "calculationMethod" TEXT,
    "frequency" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorMeasurement" (
    "id" TEXT NOT NULL,
    "pilotFacilityId" TEXT NOT NULL,
    "impactIndicatorId" TEXT NOT NULL,
    "measurementPeriod" TIMESTAMP(3) NOT NULL,
    "measurementType" "MeasurementType" NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostRecord" (
    "id" TEXT NOT NULL,
    "pilotProjectId" TEXT NOT NULL,
    "facilityId" TEXT,
    "costCategory" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'NGN',
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityLocalId" TEXT,
    "entityServerId" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "payloadHash" TEXT,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_isoCode_key" ON "Country"("isoCode");

-- CreateIndex
CREATE INDEX "Organization_countryId_status_idx" ON "Organization"("countryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_countryId_name_key" ON "Organization"("countryId", "name");

-- CreateIndex
CREATE INDEX "AdministrativeUnit_organizationId_type_idx" ON "AdministrativeUnit"("organizationId", "type");

-- CreateIndex
CREATE INDEX "AdministrativeUnit_parentId_idx" ON "AdministrativeUnit"("parentId");

-- CreateIndex
CREATE INDEX "Facility_administrativeUnitId_idx" ON "Facility"("administrativeUnitId");

-- CreateIndex
CREATE INDEX "Facility_status_idx" ON "Facility"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_organizationId_facilityCode_key" ON "Facility"("organizationId", "facilityCode");

-- CreateIndex
CREATE INDEX "FacilityContact_normalizedPhone_idx" ON "FacilityContact"("normalizedPhone");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityContact_facilityId_contactKey_key" ON "FacilityContact"("facilityId", "contactKey");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityDepartment_facilityId_name_key" ON "FacilityDepartment"("facilityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_status_idx" ON "User"("organizationId", "status");

-- CreateIndex
CREATE INDEX "User_facilityId_idx" ON "User"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserScope_userId_administrativeUnitId_key" ON "UserScope"("userId", "administrativeUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentCategory_name_key" ON "EquipmentCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_categoryId_name_key" ON "EquipmentType"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_name_key" ON "Manufacturer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentModel_manufacturerId_modelName_key" ON "EquipmentModel"("manufacturerId", "modelName");

-- CreateIndex
CREATE INDEX "Equipment_equipmentTypeId_idx" ON "Equipment"("equipmentTypeId");

-- CreateIndex
CREATE INDEX "Equipment_functionalityStatus_idx" ON "Equipment"("functionalityStatus");

-- CreateIndex
CREATE INDEX "Equipment_warrantyEndDate_idx" ON "Equipment"("warrantyEndDate");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_facilityId_assetCode_key" ON "Equipment"("facilityId", "assetCode");

-- CreateIndex
CREATE INDEX "EquipmentStatusHistory_equipmentId_changedAt_idx" ON "EquipmentStatusHistory"("equipmentId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sop_equipmentTypeId_title_version_key" ON "Sop"("equipmentTypeId", "title", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_equipmentTypeId_name_version_key" ON "ChecklistTemplate"("equipmentTypeId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_checklistTemplateId_sequenceOrder_key" ON "ChecklistItem"("checklistTemplateId", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItemOption_checklistItemId_value_key" ON "ChecklistItemOption"("checklistItemId", "value");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_equipmentId_active_idx" ON "MaintenanceSchedule"("equipmentId", "active");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_nextRunAt_idx" ON "MaintenanceSchedule"("nextRunAt");

-- CreateIndex
CREATE INDEX "MaintenanceTask_facilityId_status_idx" ON "MaintenanceTask"("facilityId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceTask_assignedUserId_dueAt_idx" ON "MaintenanceTask"("assignedUserId", "dueAt");

-- CreateIndex
CREATE INDEX "MaintenanceTask_equipmentId_scheduledAt_idx" ON "MaintenanceTask"("equipmentId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskItemResponse_maintenanceTaskId_checklistItemId_key" ON "TaskItemResponse"("maintenanceTaskId", "checklistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredDevice_userId_deviceIdentifier_key" ON "RegisteredDevice"("userId", "deviceIdentifier");

-- CreateIndex
CREATE INDEX "EvidenceFile_maintenanceTaskId_idx" ON "EvidenceFile"("maintenanceTaskId");

-- CreateIndex
CREATE INDEX "EvidenceFile_facilityId_capturedAtDevice_idx" ON "EvidenceFile"("facilityId", "capturedAtDevice");

-- CreateIndex
CREATE INDEX "EvidenceFile_verificationStatus_idx" ON "EvidenceFile"("verificationStatus");

-- CreateIndex
CREATE INDEX "Alert_status_severity_idx" ON "Alert"("status", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRecipient_alertId_userId_deliveryChannel_key" ON "AlertRecipient"("alertId", "userId", "deliveryChannel");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceTicket_ticketNumber_key" ON "MaintenanceTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_organizationId_status_idx" ON "MaintenanceTicket"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_administrativeUnitId_status_idx" ON "MaintenanceTicket"("administrativeUnitId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_facilityId_status_idx" ON "MaintenanceTicket"("facilityId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_assignedTechnicianId_status_idx" ON "MaintenanceTicket"("assignedTechnicianId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_priority_status_idx" ON "MaintenanceTicket"("priority", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceTicket_reportedById_clientRequestId_key" ON "MaintenanceTicket"("reportedById", "clientRequestId");

-- CreateIndex
CREATE INDEX "TicketActivity_ticketId_createdAt_idx" ON "TicketActivity"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketComment_authorId_createdAt_idx" ON "TicketComment"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_createdAt_idx" ON "TicketAttachment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAttachment_commentId_idx" ON "TicketAttachment"("commentId");

-- CreateIndex
CREATE INDEX "TicketAssignment_ticketId_endedAt_idx" ON "TicketAssignment"("ticketId", "endedAt");

-- CreateIndex
CREATE INDEX "TicketAssignment_assignedToId_endedAt_idx" ON "TicketAssignment"("assignedToId", "endedAt");

-- CreateIndex
CREATE INDEX "TicketEscalation_ticketId_createdAt_idx" ON "TicketEscalation"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketEscalation_toLevel_createdAt_idx" ON "TicketEscalation"("toLevel", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceSnapshot_facilityId_periodStart_idx" ON "ComplianceSnapshot"("facilityId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceSnapshot_scopeType_scopeId_periodStart_periodEnd_key" ON "ComplianceSnapshot"("scopeType", "scopeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentPerformanceMetric_equipmentId_periodStart_periodEn_key" ON "EquipmentPerformanceMetric"("equipmentId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SimulationSession_organizationId_enabled_idx" ON "SimulationSession"("organizationId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "RewardLevel_name_key" ON "RewardLevel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RewardAccount_userId_key" ON "RewardAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardRule_activityType_key" ON "RewardRule"("activityType");

-- CreateIndex
CREATE INDEX "RewardTransaction_rewardAccountId_createdAt_idx" ON "RewardTransaction"("rewardAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardTransaction_activityType_referenceId_key" ON "RewardTransaction"("activityType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_name_key" ON "Badge"("name");

-- CreateIndex
CREATE INDEX "RewardRedemption_status_requestedAt_idx" ON "RewardRedemption"("status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningModule_courseId_sequenceOrder_key" ON "LearningModule"("courseId", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_courseId_userId_key" ON "CourseEnrollment"("courseId", "userId");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_status_priority_idx" ON "FeedbackSubmission"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "PilotFacility_pilotProjectId_facilityId_key" ON "PilotFacility"("pilotProjectId", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactIndicator_pilotProjectId_name_key" ON "ImpactIndicator"("pilotProjectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorMeasurement_pilotFacilityId_impactIndicatorId_meas_key" ON "IndicatorMeasurement"("pilotFacilityId", "impactIndicatorId", "measurementPeriod", "measurementType");

-- CreateIndex
CREATE INDEX "CostRecord_pilotProjectId_costCategory_idx" ON "CostRecord"("pilotProjectId", "costCategory");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncLog_userId_status_idx" ON "SyncLog"("userId", "status");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeUnit" ADD CONSTRAINT "AdministrativeUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeUnit" ADD CONSTRAINT "AdministrativeUnit_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeUnit" ADD CONSTRAINT "AdministrativeUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AdministrativeUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_administrativeUnitId_fkey" FOREIGN KEY ("administrativeUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityContact" ADD CONSTRAINT "FacilityContact_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityDepartment" ADD CONSTRAINT "FacilityDepartment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityDepartment" ADD CONSTRAINT "FacilityDepartment_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScope" ADD CONSTRAINT "UserScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScope" ADD CONSTRAINT "UserScope_administrativeUnitId_fkey" FOREIGN KEY ("administrativeUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentType" ADD CONSTRAINT "EquipmentType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentModel" ADD CONSTRAINT "EquipmentModel_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentModel" ADD CONSTRAINT "EquipmentModel_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "FacilityDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_equipmentModelId_fkey" FOREIGN KEY ("equipmentModelId") REFERENCES "EquipmentModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentStatusHistory" ADD CONSTRAINT "EquipmentStatusHistory_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentDocument" ADD CONSTRAINT "EquipmentDocument_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sop" ADD CONSTRAINT "Sop_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SopResource" ADD CONSTRAINT "SopResource_sopId_fkey" FOREIGN KEY ("sopId") REFERENCES "Sop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_sopId_fkey" FOREIGN KEY ("sopId") REFERENCES "Sop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemOption" ADD CONSTRAINT "ChecklistItemOption_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRule" ADD CONSTRAINT "ChecklistRule_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_assignedRoleId_fkey" FOREIGN KEY ("assignedRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_maintenanceScheduleId_fkey" FOREIGN KEY ("maintenanceScheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskItemResponse" ADD CONSTRAINT "TaskItemResponse_maintenanceTaskId_fkey" FOREIGN KEY ("maintenanceTaskId") REFERENCES "MaintenanceTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskItemResponse" ADD CONSTRAINT "TaskItemResponse_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisteredDevice" ADD CONSTRAINT "RegisteredDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_maintenanceTaskId_fkey" FOREIGN KEY ("maintenanceTaskId") REFERENCES "MaintenanceTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_taskItemResponseId_fkey" FOREIGN KEY ("taskItemResponseId") REFERENCES "TaskItemResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_registeredDeviceId_fkey" FOREIGN KEY ("registeredDeviceId") REFERENCES "RegisteredDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_maintenanceTaskId_fkey" FOREIGN KEY ("maintenanceTaskId") REFERENCES "MaintenanceTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRecipient" ADD CONSTRAINT "AlertRecipient_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRecipient" ADD CONSTRAINT "AlertRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_administrativeUnitId_fkey" FOREIGN KEY ("administrativeUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_maintenanceTaskId_fkey" FOREIGN KEY ("maintenanceTaskId") REFERENCES "MaintenanceTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TicketComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEscalation" ADD CONSTRAINT "TicketEscalation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEscalation" ADD CONSTRAINT "TicketEscalation_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDiagnosis" ADD CONSTRAINT "TicketDiagnosis_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRepair" ADD CONSTRAINT "TicketRepair_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPart" ADD CONSTRAINT "TicketPart_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceSnapshot" ADD CONSTRAINT "ComplianceSnapshot_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentPerformanceMetric" ADD CONSTRAINT "EquipmentPerformanceMetric_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationSession" ADD CONSTRAINT "SimulationSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationSession" ADD CONSTRAINT "SimulationSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationEvent" ADD CONSTRAINT "SimulationEvent_simulationSessionId_fkey" FOREIGN KEY ("simulationSessionId") REFERENCES "SimulationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAccount" ADD CONSTRAINT "RewardAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAccount" ADD CONSTRAINT "RewardAccount_currentLevelId_fkey" FOREIGN KEY ("currentLevelId") REFERENCES "RewardLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_rewardAccountId_fkey" FOREIGN KEY ("rewardAccountId") REFERENCES "RewardAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardAccountId_fkey" FOREIGN KEY ("rewardAccountId") REFERENCES "RewardAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardCatalogueId_fkey" FOREIGN KEY ("rewardCatalogueId") REFERENCES "RewardCatalogue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCourse" ADD CONSTRAINT "LearningCourse_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningModule" ADD CONSTRAINT "LearningModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LearningCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LearningCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partnership" ADD CONSTRAINT "Partnership_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotProject" ADD CONSTRAINT "PilotProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFacility" ADD CONSTRAINT "PilotFacility_pilotProjectId_fkey" FOREIGN KEY ("pilotProjectId") REFERENCES "PilotProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFacility" ADD CONSTRAINT "PilotFacility_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactIndicator" ADD CONSTRAINT "ImpactIndicator_pilotProjectId_fkey" FOREIGN KEY ("pilotProjectId") REFERENCES "PilotProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorMeasurement" ADD CONSTRAINT "IndicatorMeasurement_pilotFacilityId_fkey" FOREIGN KEY ("pilotFacilityId") REFERENCES "PilotFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorMeasurement" ADD CONSTRAINT "IndicatorMeasurement_impactIndicatorId_fkey" FOREIGN KEY ("impactIndicatorId") REFERENCES "ImpactIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRecord" ADD CONSTRAINT "CostRecord_pilotProjectId_fkey" FOREIGN KEY ("pilotProjectId") REFERENCES "PilotProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRecord" ADD CONSTRAINT "CostRecord_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
