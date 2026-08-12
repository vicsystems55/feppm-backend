-- CreateTable
CREATE TABLE `Country` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isoCode` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Africa/Lagos',
    `currencyCode` VARCHAR(191) NOT NULL DEFAULT 'NGN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Country_isoCode_key`(`isoCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Organization` (
    `id` VARCHAR(191) NOT NULL,
    `countryId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `type` ENUM('GOVERNMENT', 'NGO', 'PRIVATE', 'DONOR', 'RESEARCH', 'VENDOR', 'OTHER') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Organization_countryId_status_idx`(`countryId`, `status`),
    UNIQUE INDEX `Organization_countryId_name_key`(`countryId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdministrativeUnit` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `countryId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `type` ENUM('NATIONAL', 'ZONE', 'REGION', 'STATE', 'LGA', 'DISTRICT', 'WARD', 'OTHER') NOT NULL,
    `timezone` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdministrativeUnit_organizationId_type_idx`(`organizationId`, `type`),
    INDEX `AdministrativeUnit_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Facility` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `countryId` VARCHAR(191) NOT NULL,
    `administrativeUnitId` VARCHAR(191) NOT NULL,
    `managerUserId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `facilityCode` VARCHAR(191) NULL,
    `facilityType` ENUM('PRIMARY_HEALTH_CENTRE', 'GENERAL_HOSPITAL', 'TEACHING_HOSPITAL', 'SPECIALIST_HOSPITAL', 'LABORATORY', 'WAREHOUSE', 'HEALTH_POST', 'OTHER') NOT NULL,
    `ownershipType` ENUM('FEDERAL', 'STATE', 'LGA', 'PRIVATE', 'NGO', 'FAITH_BASED', 'OTHER') NULL,
    `address` VARCHAR(191) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `geofenceRadiusMeters` INTEGER NOT NULL DEFAULT 250,
    `contactPhone` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Africa/Lagos',
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Facility_administrativeUnitId_idx`(`administrativeUnitId`),
    INDEX `Facility_status_idx`(`status`),
    UNIQUE INDEX `Facility_organizationId_facilityCode_key`(`organizationId`, `facilityCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FacilityDepartment` (
    `id` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NOT NULL,
    `managerUserId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FacilityDepartment_facilityId_name_key`(`facilityId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `User_facilityId_idx`(`facilityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Permission_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserScope` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `administrativeUnitId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserScope_userId_administrativeUnitId_key`(`userId`, `administrativeUnitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipmentCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EquipmentCategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipmentType` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `expectedUsefulLifeYears` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EquipmentType_categoryId_name_key`(`categoryId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Manufacturer` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `countryName` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Manufacturer_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipmentModel` (
    `id` VARCHAR(191) NOT NULL,
    `manufacturerId` VARCHAR(191) NOT NULL,
    `equipmentTypeId` VARCHAR(191) NOT NULL,
    `modelName` VARCHAR(191) NOT NULL,
    `technicalSpecs` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EquipmentModel_manufacturerId_modelName_key`(`manufacturerId`, `modelName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vendor` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Equipment` (
    `id` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `equipmentTypeId` VARCHAR(191) NOT NULL,
    `equipmentModelId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `assetCode` VARCHAR(191) NOT NULL,
    `serialNumber` VARCHAR(191) NULL,
    `yearOfManufacture` INTEGER NULL,
    `installationDate` DATETIME(3) NULL,
    `commissioningDate` DATETIME(3) NULL,
    `powerSource` VARCHAR(191) NULL,
    `functionalityStatus` ENUM('FUNCTIONAL', 'PARTIALLY_FUNCTIONAL', 'NON_FUNCTIONAL', 'UNDER_REPAIR', 'DECOMMISSIONED', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `conditionStatus` ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `warrantyStartDate` DATETIME(3) NULL,
    `warrantyEndDate` DATETIME(3) NULL,
    `expectedEndOfLife` DATETIME(3) NULL,
    `purchaseCost` DECIMAL(14, 2) NULL,
    `replacementCost` DECIMAL(14, 2) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Equipment_equipmentTypeId_idx`(`equipmentTypeId`),
    INDEX `Equipment_functionalityStatus_idx`(`functionalityStatus`),
    INDEX `Equipment_warrantyEndDate_idx`(`warrantyEndDate`),
    UNIQUE INDEX `Equipment_facilityId_assetCode_key`(`facilityId`, `assetCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipmentStatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `equipmentId` VARCHAR(191) NOT NULL,
    `previousStatus` ENUM('FUNCTIONAL', 'PARTIALLY_FUNCTIONAL', 'NON_FUNCTIONAL', 'UNDER_REPAIR', 'DECOMMISSIONED', 'UNKNOWN') NULL,
    `newStatus` ENUM('FUNCTIONAL', 'PARTIALLY_FUNCTIONAL', 'NON_FUNCTIONAL', 'UNDER_REPAIR', 'DECOMMISSIONED', 'UNKNOWN') NOT NULL,
    `reason` VARCHAR(191) NULL,
    `changedById` VARCHAR(191) NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EquipmentStatusHistory_equipmentId_changedAt_idx`(`equipmentId`, `changedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipmentDocument` (
    `id` VARCHAR(191) NOT NULL,
    `equipmentId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sop` (
    `id` VARCHAR(191) NOT NULL,
    `equipmentTypeId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `effectiveDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdById` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Sop_equipmentTypeId_title_version_key`(`equipmentTypeId`, `title`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SopResource` (
    `id` VARCHAR(191) NOT NULL,
    `sopId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `resourceUrl` VARCHAR(191) NOT NULL,
    `resourceType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChecklistTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `equipmentTypeId` VARCHAR(191) NOT NULL,
    `sopId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `frequencyType` ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SIX_MONTHLY', 'ANNUAL', 'CUSTOM') NOT NULL,
    `customCronExpression` VARCHAR(191) NULL,
    `estimatedDurationMinutes` INTEGER NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChecklistTemplate_equipmentTypeId_name_version_key`(`equipmentTypeId`, `name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChecklistItem` (
    `id` VARCHAR(191) NOT NULL,
    `checklistTemplateId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `instruction` VARCHAR(191) NULL,
    `correctiveAction` VARCHAR(191) NULL,
    `inputType` ENUM('CHECKBOX', 'YES_NO', 'PASS_FAIL', 'NUMBER', 'TEMPERATURE', 'HUMIDITY', 'DATE', 'TIME', 'SHORT_TEXT', 'LONG_TEXT', 'DROPDOWN', 'MULTI_SELECT', 'PHOTO', 'MULTIPLE_PHOTOS', 'SIGNATURE', 'GPS_CONFIRMATION') NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `evidenceRequirement` ENUM('NONE', 'OPTIONAL', 'REQUIRED') NOT NULL DEFAULT 'NONE',
    `technicianOnly` BOOLEAN NOT NULL DEFAULT false,
    `sequenceOrder` INTEGER NOT NULL,
    `weight` DECIMAL(5, 2) NULL,
    `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChecklistItem_checklistTemplateId_sequenceOrder_key`(`checklistTemplateId`, `sequenceOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChecklistItemOption` (
    `id` VARCHAR(191) NOT NULL,
    `checklistItemId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `sequenceOrder` INTEGER NOT NULL,

    UNIQUE INDEX `ChecklistItemOption_checklistItemId_value_key`(`checklistItemId`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChecklistRule` (
    `id` VARCHAR(191) NOT NULL,
    `checklistItemId` VARCHAR(191) NOT NULL,
    `operator` VARCHAR(191) NOT NULL,
    `thresholdMin` DECIMAL(14, 4) NULL,
    `thresholdMax` DECIMAL(14, 4) NULL,
    `expectedValue` VARCHAR(191) NULL,
    `resultStatus` VARCHAR(191) NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `createAlert` BOOLEAN NOT NULL DEFAULT false,
    `createTicket` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `equipmentId` VARCHAR(191) NOT NULL,
    `checklistTemplateId` VARCHAR(191) NOT NULL,
    `assignedRoleId` VARCHAR(191) NULL,
    `assignedUserId` VARCHAR(191) NULL,
    `frequencyType` ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SIX_MONTHLY', 'ANNUAL', 'CUSTOM') NOT NULL,
    `customCronExpression` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `dueTime` VARCHAR(191) NULL,
    `gracePeriodMinutes` INTEGER NOT NULL DEFAULT 0,
    `nextRunAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MaintenanceSchedule_equipmentId_active_idx`(`equipmentId`, `active`),
    INDEX `MaintenanceSchedule_nextRunAt_idx`(`nextRunAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceTask` (
    `id` VARCHAR(191) NOT NULL,
    `maintenanceScheduleId` VARCHAR(191) NOT NULL,
    `equipmentId` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NOT NULL,
    `assignedUserId` VARCHAR(191) NULL,
    `completedById` VARCHAR(191) NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `overdueAt` DATETIME(3) NULL,
    `status` ENUM('UPCOMING', 'DUE', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED_ON_TIME', 'COMPLETED_LATE', 'OVERDUE', 'MISSED', 'WAIVED', 'NOT_APPLICABLE', 'CANCELLED') NOT NULL DEFAULT 'UPCOMING',
    `startedAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `completionClassification` ENUM('ON_TIME', 'WITHIN_GRACE_PERIOD', 'LATE', 'MISSED', 'WAIVED', 'NOT_APPLICABLE') NULL,
    `complianceScore` DECIMAL(5, 2) NULL,
    `submittedOffline` BOOLEAN NOT NULL DEFAULT false,
    `syncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MaintenanceTask_facilityId_status_idx`(`facilityId`, `status`),
    INDEX `MaintenanceTask_assignedUserId_dueAt_idx`(`assignedUserId`, `dueAt`),
    INDEX `MaintenanceTask_equipmentId_scheduledAt_idx`(`equipmentId`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskItemResponse` (
    `id` VARCHAR(191) NOT NULL,
    `maintenanceTaskId` VARCHAR(191) NOT NULL,
    `checklistItemId` VARCHAR(191) NOT NULL,
    `responseBoolean` BOOLEAN NULL,
    `responseNumber` DECIMAL(14, 4) NULL,
    `responseText` VARCHAR(191) NULL,
    `responseOptionId` VARCHAR(191) NULL,
    `passed` BOOLEAN NULL,
    `comment` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TaskItemResponse_maintenanceTaskId_checklistItemId_key`(`maintenanceTaskId`, `checklistItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegisteredDevice` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deviceIdentifier` VARCHAR(191) NOT NULL,
    `deviceModel` VARCHAR(191) NULL,
    `platform` VARCHAR(191) NULL,
    `appVersion` VARCHAR(191) NULL,
    `isTrusted` BOOLEAN NOT NULL DEFAULT false,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RegisteredDevice_userId_deviceIdentifier_key`(`userId`, `deviceIdentifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvidenceFile` (
    `id` VARCHAR(191) NOT NULL,
    `maintenanceTaskId` VARCHAR(191) NULL,
    `taskItemResponseId` VARCHAR(191) NULL,
    `equipmentId` VARCHAR(191) NULL,
    `facilityId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `registeredDeviceId` VARCHAR(191) NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `thumbnailUrl` VARCHAR(191) NULL,
    `fileHash` VARCHAR(191) NULL,
    `capturedAtDevice` DATETIME(3) NOT NULL,
    `receivedAtServer` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `gpsAccuracy` DECIMAL(10, 2) NULL,
    `distanceFromFacilityMeters` DECIMAL(12, 2) NULL,
    `capturedOffline` BOOLEAN NOT NULL DEFAULT false,
    `syncedAt` DATETIME(3) NULL,
    `verificationStatus` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'FLAGGED') NOT NULL DEFAULT 'PENDING',
    `suspiciousFlag` BOOLEAN NOT NULL DEFAULT false,
    `watermarkData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EvidenceFile_maintenanceTaskId_idx`(`maintenanceTaskId`),
    INDEX `EvidenceFile_facilityId_capturedAtDevice_idx`(`facilityId`, `capturedAtDevice`),
    INDEX `EvidenceFile_verificationStatus_idx`(`verificationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Alert` (
    `id` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NULL,
    `equipmentId` VARCHAR(191) NULL,
    `maintenanceTaskId` VARCHAR(191) NULL,
    `ticketId` VARCHAR(191) NULL,
    `alertType` VARCHAR(191) NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `triggeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledgedAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Alert_status_severity_idx`(`status`, `severity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AlertRecipient` (
    `id` VARCHAR(191) NOT NULL,
    `alertId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deliveryChannel` ENUM('IN_APP', 'PUSH', 'EMAIL', 'SMS') NOT NULL,
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AlertRecipient_alertId_userId_deliveryChannel_key`(`alertId`, `userId`, `deliveryChannel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceTicket` (
    `id` VARCHAR(191) NOT NULL,
    `ticketNumber` VARCHAR(191) NOT NULL,
    `equipmentId` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NOT NULL,
    `maintenanceTaskId` VARCHAR(191) NULL,
    `reportedById` VARCHAR(191) NOT NULL,
    `assignedTechnicianId` VARCHAR(191) NULL,
    `sourceType` ENUM('FAILED_CHECKLIST', 'ABNORMAL_READING', 'USER_REPORT', 'SUPERVISOR_OBSERVATION', 'SCHEDULED_INSPECTION', 'SYSTEM_ALERT') NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `faultDescription` VARCHAR(191) NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 3,
    `status` ENUM('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `reportedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledgedAt` DATETIME(3) NULL,
    `workStartedAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `downtimeMinutes` INTEGER NULL,
    `estimatedCost` DECIMAL(14, 2) NULL,
    `actualCost` DECIMAL(14, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MaintenanceTicket_ticketNumber_key`(`ticketNumber`),
    INDEX `MaintenanceTicket_facilityId_status_idx`(`facilityId`, `status`),
    INDEX `MaintenanceTicket_assignedTechnicianId_status_idx`(`assignedTechnicianId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketActivity` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `comment` VARCHAR(191) NULL,
    `oldStatus` ENUM('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED', 'CANCELLED') NULL,
    `newStatus` ENUM('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED', 'CANCELLED') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketActivity_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketDiagnosis` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `diagnosis` VARCHAR(191) NOT NULL,
    `rootCause` VARCHAR(191) NULL,
    `recommendedAction` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketRepair` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `actionTaken` VARCHAR(191) NOT NULL,
    `repairOutcome` VARCHAR(191) NULL,
    `equipmentStatusAfterRepair` ENUM('FUNCTIONAL', 'PARTIALLY_FUNCTIONAL', 'NON_FUNCTIONAL', 'UNDER_REPAIR', 'DECOMMISSIONED', 'UNKNOWN') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketPart` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `partName` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitCost` DECIMAL(14, 2) NULL,
    `totalCost` DECIMAL(14, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NULL,
    `scopeType` VARCHAR(191) NOT NULL,
    `scopeId` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `tasksDue` INTEGER NOT NULL,
    `tasksCompleted` INTEGER NOT NULL,
    `tasksCompletedOnTime` INTEGER NOT NULL,
    `tasksCompletedLate` INTEGER NOT NULL,
    `tasksMissed` INTEGER NOT NULL,
    `compliancePercentage` DECIMAL(5, 2) NOT NULL,
    `completionPercentage` DECIMAL(5, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ComplianceSnapshot_facilityId_periodStart_idx`(`facilityId`, `periodStart`),
    UNIQUE INDEX `ComplianceSnapshot_scopeType_scopeId_periodStart_periodEnd_key`(`scopeType`, `scopeId`, `periodStart`, `periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipmentPerformanceMetric` (
    `id` VARCHAR(191) NOT NULL,
    `equipmentId` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `uptimeMinutes` INTEGER NOT NULL DEFAULT 0,
    `downtimeMinutes` INTEGER NOT NULL DEFAULT 0,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `repeatFailureCount` INTEGER NOT NULL DEFAULT 0,
    `maintenanceCount` INTEGER NOT NULL DEFAULT 0,
    `meanTimeBetweenFailures` DECIMAL(14, 2) NULL,
    `meanTimeToRepair` DECIMAL(14, 2) NULL,
    `healthScore` DECIMAL(5, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EquipmentPerformanceMetric_equipmentId_periodStart_periodEnd_key`(`equipmentId`, `periodStart`, `periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SimulationSession` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `simulatedDatetime` DATETIME(3) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Africa/Lagos',
    `speedMultiplier` DECIMAL(8, 2) NOT NULL DEFAULT 1,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SimulationSession_organizationId_enabled_idx`(`organizationId`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SimulationEvent` (
    `id` VARCHAR(191) NOT NULL,
    `simulationSessionId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardLevel` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `minimumCredits` INTEGER NOT NULL,
    `maximumCredits` INTEGER NULL,
    `benefits` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RewardLevel_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardAccount` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `currentLevelId` VARCHAR(191) NULL,
    `totalCredits` INTEGER NOT NULL DEFAULT 0,
    `lifetimeCredits` INTEGER NOT NULL DEFAULT 0,
    `currentStreakDays` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RewardAccount_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardRule` (
    `id` VARCHAR(191) NOT NULL,
    `activityType` VARCHAR(191) NOT NULL,
    `creditValue` INTEGER NOT NULL DEFAULT 0,
    `penaltyValue` INTEGER NOT NULL DEFAULT 0,
    `dailyLimit` INTEGER NULL,
    `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RewardRule_activityType_key`(`activityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `rewardAccountId` VARCHAR(191) NOT NULL,
    `activityType` VARCHAR(191) NOT NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `credits` INTEGER NOT NULL,
    `transactionType` ENUM('CREDIT', 'PENALTY', 'REDEMPTION', 'ADJUSTMENT') NOT NULL,
    `description` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RewardTransaction_rewardAccountId_createdAt_idx`(`rewardAccountId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Badge` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Badge_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserBadge` (
    `userId` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL,
    `earnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `badgeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardCatalogue` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `creditCost` INTEGER NOT NULL,
    `stockCount` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `rewardAccountId` VARCHAR(191) NOT NULL,
    `rewardCatalogueId` VARCHAR(191) NOT NULL,
    `creditsUsed` INTEGER NOT NULL,
    `status` ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fulfilledAt` DATETIME(3) NULL,

    INDEX `RewardRedemption_status_requestedAt_idx`(`status`, `requestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LearningCourse` (
    `id` VARCHAR(191) NOT NULL,
    `equipmentTypeId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `courseType` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LearningModule` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `sequenceOrder` INTEGER NOT NULL,
    `content` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LearningModule_courseId_sequenceOrder_key`(`courseId`, `sequenceOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseEnrollment` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `progress` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CourseEnrollment_courseId_userId_key`(`courseId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Partnership` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NULL,
    `organizationName` VARCHAR(191) NOT NULL,
    `partnerType` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `agreementStart` DATETIME(3) NULL,
    `agreementEnd` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeedbackSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NULL,
    `equipmentId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
    `status` ENUM('OPEN', 'IN_REVIEW', 'ASSIGNED', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `assignedToId` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FeedbackSubmission_status_priority_idx`(`status`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PilotProject` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `pilotStage` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PilotFacility` (
    `id` VARCHAR(191) NOT NULL,
    `pilotProjectId` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NOT NULL,
    `groupType` ENUM('INTERVENTION', 'COMPARISON', 'OBSERVATION') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PilotFacility_pilotProjectId_facilityId_key`(`pilotProjectId`, `facilityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImpactIndicator` (
    `id` VARCHAR(191) NOT NULL,
    `pilotProjectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `indicatorType` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `calculationMethod` VARCHAR(191) NULL,
    `frequency` VARCHAR(191) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ImpactIndicator_pilotProjectId_name_key`(`pilotProjectId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IndicatorMeasurement` (
    `id` VARCHAR(191) NOT NULL,
    `pilotFacilityId` VARCHAR(191) NOT NULL,
    `impactIndicatorId` VARCHAR(191) NOT NULL,
    `measurementPeriod` DATETIME(3) NOT NULL,
    `measurementType` ENUM('BASELINE', 'MONTHLY', 'MIDLINE', 'ENDLINE', 'FOLLOW_UP') NOT NULL,
    `value` DECIMAL(18, 4) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `IndicatorMeasurement_pilotFacilityId_impactIndicatorId_measu_key`(`pilotFacilityId`, `impactIndicatorId`, `measurementPeriod`, `measurementType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostRecord` (
    `id` VARCHAR(191) NOT NULL,
    `pilotProjectId` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NULL,
    `costCategory` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currencyCode` VARCHAR(191) NOT NULL DEFAULT 'NGN',
    `incurredAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CostRecord_pilotProjectId_costCategory_idx`(`pilotProjectId`, `costCategory`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `oldValues` JSON NULL,
    `newValues` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityLocalId` VARCHAR(191) NULL,
    `entityServerId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SYNCING', 'SYNCED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` VARCHAR(191) NULL,
    `attemptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `payloadHash` VARCHAR(191) NULL,

    INDEX `SyncLog_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Organization` ADD CONSTRAINT `Organization_countryId_fkey` FOREIGN KEY (`countryId`) REFERENCES `Country`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdministrativeUnit` ADD CONSTRAINT `AdministrativeUnit_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdministrativeUnit` ADD CONSTRAINT `AdministrativeUnit_countryId_fkey` FOREIGN KEY (`countryId`) REFERENCES `Country`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdministrativeUnit` ADD CONSTRAINT `AdministrativeUnit_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `AdministrativeUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Facility` ADD CONSTRAINT `Facility_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Facility` ADD CONSTRAINT `Facility_countryId_fkey` FOREIGN KEY (`countryId`) REFERENCES `Country`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Facility` ADD CONSTRAINT `Facility_administrativeUnitId_fkey` FOREIGN KEY (`administrativeUnitId`) REFERENCES `AdministrativeUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Facility` ADD CONSTRAINT `Facility_managerUserId_fkey` FOREIGN KEY (`managerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FacilityDepartment` ADD CONSTRAINT `FacilityDepartment_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FacilityDepartment` ADD CONSTRAINT `FacilityDepartment_managerUserId_fkey` FOREIGN KEY (`managerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserScope` ADD CONSTRAINT `UserScope_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserScope` ADD CONSTRAINT `UserScope_administrativeUnitId_fkey` FOREIGN KEY (`administrativeUnitId`) REFERENCES `AdministrativeUnit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipmentType` ADD CONSTRAINT `EquipmentType_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `EquipmentCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipmentModel` ADD CONSTRAINT `EquipmentModel_manufacturerId_fkey` FOREIGN KEY (`manufacturerId`) REFERENCES `Manufacturer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipmentModel` ADD CONSTRAINT `EquipmentModel_equipmentTypeId_fkey` FOREIGN KEY (`equipmentTypeId`) REFERENCES `EquipmentType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `FacilityDepartment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_equipmentTypeId_fkey` FOREIGN KEY (`equipmentTypeId`) REFERENCES `EquipmentType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_equipmentModelId_fkey` FOREIGN KEY (`equipmentModelId`) REFERENCES `EquipmentModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipmentStatusHistory` ADD CONSTRAINT `EquipmentStatusHistory_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipmentDocument` ADD CONSTRAINT `EquipmentDocument_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sop` ADD CONSTRAINT `Sop_equipmentTypeId_fkey` FOREIGN KEY (`equipmentTypeId`) REFERENCES `EquipmentType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SopResource` ADD CONSTRAINT `SopResource_sopId_fkey` FOREIGN KEY (`sopId`) REFERENCES `Sop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChecklistTemplate` ADD CONSTRAINT `ChecklistTemplate_equipmentTypeId_fkey` FOREIGN KEY (`equipmentTypeId`) REFERENCES `EquipmentType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChecklistTemplate` ADD CONSTRAINT `ChecklistTemplate_sopId_fkey` FOREIGN KEY (`sopId`) REFERENCES `Sop`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChecklistItem` ADD CONSTRAINT `ChecklistItem_checklistTemplateId_fkey` FOREIGN KEY (`checklistTemplateId`) REFERENCES `ChecklistTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChecklistItemOption` ADD CONSTRAINT `ChecklistItemOption_checklistItemId_fkey` FOREIGN KEY (`checklistItemId`) REFERENCES `ChecklistItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChecklistRule` ADD CONSTRAINT `ChecklistRule_checklistItemId_fkey` FOREIGN KEY (`checklistItemId`) REFERENCES `ChecklistItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceSchedule` ADD CONSTRAINT `MaintenanceSchedule_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceSchedule` ADD CONSTRAINT `MaintenanceSchedule_checklistTemplateId_fkey` FOREIGN KEY (`checklistTemplateId`) REFERENCES `ChecklistTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceSchedule` ADD CONSTRAINT `MaintenanceSchedule_assignedRoleId_fkey` FOREIGN KEY (`assignedRoleId`) REFERENCES `Role`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceSchedule` ADD CONSTRAINT `MaintenanceSchedule_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTask` ADD CONSTRAINT `MaintenanceTask_maintenanceScheduleId_fkey` FOREIGN KEY (`maintenanceScheduleId`) REFERENCES `MaintenanceSchedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTask` ADD CONSTRAINT `MaintenanceTask_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTask` ADD CONSTRAINT `MaintenanceTask_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTask` ADD CONSTRAINT `MaintenanceTask_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTask` ADD CONSTRAINT `MaintenanceTask_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskItemResponse` ADD CONSTRAINT `TaskItemResponse_maintenanceTaskId_fkey` FOREIGN KEY (`maintenanceTaskId`) REFERENCES `MaintenanceTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskItemResponse` ADD CONSTRAINT `TaskItemResponse_checklistItemId_fkey` FOREIGN KEY (`checklistItemId`) REFERENCES `ChecklistItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegisteredDevice` ADD CONSTRAINT `RegisteredDevice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvidenceFile` ADD CONSTRAINT `EvidenceFile_maintenanceTaskId_fkey` FOREIGN KEY (`maintenanceTaskId`) REFERENCES `MaintenanceTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvidenceFile` ADD CONSTRAINT `EvidenceFile_taskItemResponseId_fkey` FOREIGN KEY (`taskItemResponseId`) REFERENCES `TaskItemResponse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvidenceFile` ADD CONSTRAINT `EvidenceFile_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvidenceFile` ADD CONSTRAINT `EvidenceFile_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvidenceFile` ADD CONSTRAINT `EvidenceFile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvidenceFile` ADD CONSTRAINT `EvidenceFile_registeredDeviceId_fkey` FOREIGN KEY (`registeredDeviceId`) REFERENCES `RegisteredDevice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_maintenanceTaskId_fkey` FOREIGN KEY (`maintenanceTaskId`) REFERENCES `MaintenanceTask`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `MaintenanceTicket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertRecipient` ADD CONSTRAINT `AlertRecipient_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `Alert`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertRecipient` ADD CONSTRAINT `AlertRecipient_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTicket` ADD CONSTRAINT `MaintenanceTicket_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTicket` ADD CONSTRAINT `MaintenanceTicket_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTicket` ADD CONSTRAINT `MaintenanceTicket_maintenanceTaskId_fkey` FOREIGN KEY (`maintenanceTaskId`) REFERENCES `MaintenanceTask`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTicket` ADD CONSTRAINT `MaintenanceTicket_reportedById_fkey` FOREIGN KEY (`reportedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTicket` ADD CONSTRAINT `MaintenanceTicket_assignedTechnicianId_fkey` FOREIGN KEY (`assignedTechnicianId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketActivity` ADD CONSTRAINT `TicketActivity_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `MaintenanceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketDiagnosis` ADD CONSTRAINT `TicketDiagnosis_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `MaintenanceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketRepair` ADD CONSTRAINT `TicketRepair_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `MaintenanceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketPart` ADD CONSTRAINT `TicketPart_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `MaintenanceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceSnapshot` ADD CONSTRAINT `ComplianceSnapshot_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipmentPerformanceMetric` ADD CONSTRAINT `EquipmentPerformanceMetric_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SimulationSession` ADD CONSTRAINT `SimulationSession_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SimulationSession` ADD CONSTRAINT `SimulationSession_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SimulationEvent` ADD CONSTRAINT `SimulationEvent_simulationSessionId_fkey` FOREIGN KEY (`simulationSessionId`) REFERENCES `SimulationSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardAccount` ADD CONSTRAINT `RewardAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardAccount` ADD CONSTRAINT `RewardAccount_currentLevelId_fkey` FOREIGN KEY (`currentLevelId`) REFERENCES `RewardLevel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardTransaction` ADD CONSTRAINT `RewardTransaction_rewardAccountId_fkey` FOREIGN KEY (`rewardAccountId`) REFERENCES `RewardAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBadge` ADD CONSTRAINT `UserBadge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBadge` ADD CONSTRAINT `UserBadge_badgeId_fkey` FOREIGN KEY (`badgeId`) REFERENCES `Badge`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardRedemption` ADD CONSTRAINT `RewardRedemption_rewardAccountId_fkey` FOREIGN KEY (`rewardAccountId`) REFERENCES `RewardAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardRedemption` ADD CONSTRAINT `RewardRedemption_rewardCatalogueId_fkey` FOREIGN KEY (`rewardCatalogueId`) REFERENCES `RewardCatalogue`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningCourse` ADD CONSTRAINT `LearningCourse_equipmentTypeId_fkey` FOREIGN KEY (`equipmentTypeId`) REFERENCES `EquipmentType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningModule` ADD CONSTRAINT `LearningModule_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `LearningCourse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseEnrollment` ADD CONSTRAINT `CourseEnrollment_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `LearningCourse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseEnrollment` ADD CONSTRAINT `CourseEnrollment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Partnership` ADD CONSTRAINT `Partnership_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeedbackSubmission` ADD CONSTRAINT `FeedbackSubmission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeedbackSubmission` ADD CONSTRAINT `FeedbackSubmission_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeedbackSubmission` ADD CONSTRAINT `FeedbackSubmission_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PilotProject` ADD CONSTRAINT `PilotProject_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PilotFacility` ADD CONSTRAINT `PilotFacility_pilotProjectId_fkey` FOREIGN KEY (`pilotProjectId`) REFERENCES `PilotProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PilotFacility` ADD CONSTRAINT `PilotFacility_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImpactIndicator` ADD CONSTRAINT `ImpactIndicator_pilotProjectId_fkey` FOREIGN KEY (`pilotProjectId`) REFERENCES `PilotProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IndicatorMeasurement` ADD CONSTRAINT `IndicatorMeasurement_pilotFacilityId_fkey` FOREIGN KEY (`pilotFacilityId`) REFERENCES `PilotFacility`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IndicatorMeasurement` ADD CONSTRAINT `IndicatorMeasurement_impactIndicatorId_fkey` FOREIGN KEY (`impactIndicatorId`) REFERENCES `ImpactIndicator`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostRecord` ADD CONSTRAINT `CostRecord_pilotProjectId_fkey` FOREIGN KEY (`pilotProjectId`) REFERENCES `PilotProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostRecord` ADD CONSTRAINT `CostRecord_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
