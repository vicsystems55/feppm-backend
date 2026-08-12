-- Expand maintenance work orders into the FEPPM Issues & Support ticket foundation.

ALTER TABLE `MaintenanceTicket`
    ADD COLUMN `organizationId` VARCHAR(191) NULL,
    ADD COLUMN `administrativeUnitId` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('INCIDENT', 'SERVICE_REQUEST', 'COMPLAINT', 'SUGGESTION', 'TECHNICAL_SUPPORT') NOT NULL DEFAULT 'INCIDENT',
    ADD COLUMN `category` ENUM('EQUIPMENT_FAULT', 'MAINTENANCE', 'TEMPERATURE_SAFETY', 'CHECKLIST', 'INVENTORY', 'ACCESS_ACCOUNT', 'DATA_QUALITY', 'COMPLAINT', 'SUGGESTION', 'TECHNICAL_SUPPORT', 'OTHER') NOT NULL DEFAULT 'EQUIPMENT_FAULT',
    ADD COLUMN `title` VARCHAR(191) NULL,
    ADD COLUMN `impact` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN `urgency` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN `escalationLevel` ENUM('FACILITY', 'LGA', 'STATE', 'ZONE', 'NATIONAL', 'PLATFORM') NOT NULL DEFAULT 'FACILITY',
    ADD COLUMN `firstResponseAt` DATETIME(3) NULL,
    ADD COLUMN `responseDueAt` DATETIME(3) NULL,
    ADD COLUMN `resolutionDueAt` DATETIME(3) NULL,
    ADD COLUMN `slaPausedAt` DATETIME(3) NULL,
    ADD COLUMN `totalPausedMinutes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `resolutionSummary` TEXT NULL;

UPDATE `MaintenanceTicket` AS ticket
INNER JOIN `Facility` AS facility ON facility.`id` = ticket.`facilityId`
SET
    ticket.`organizationId` = facility.`organizationId`,
    ticket.`administrativeUnitId` = facility.`administrativeUnitId`,
    ticket.`title` = LEFT(ticket.`faultDescription`, 191);

ALTER TABLE `MaintenanceTicket`
    MODIFY `organizationId` VARCHAR(191) NOT NULL,
    MODIFY `equipmentId` VARCHAR(191) NULL,
    MODIFY `facilityId` VARCHAR(191) NULL,
    MODIFY `title` VARCHAR(191) NOT NULL,
    MODIFY `faultDescription` TEXT NOT NULL,
    MODIFY `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    MODIFY `status` ENUM('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR', 'ESCALATED', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED', 'CANCELLED', 'DUPLICATE') NOT NULL DEFAULT 'OPEN';

CREATE INDEX `MaintenanceTicket_organizationId_status_idx` ON `MaintenanceTicket`(`organizationId`, `status`);
CREATE INDEX `MaintenanceTicket_administrativeUnitId_status_idx` ON `MaintenanceTicket`(`administrativeUnitId`, `status`);
CREATE INDEX `MaintenanceTicket_priority_status_idx` ON `MaintenanceTicket`(`priority`, `status`);

ALTER TABLE `TicketActivity`
    ADD COLUMN `metadata` JSON NULL,
    MODIFY `oldStatus` ENUM('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR', 'ESCALATED', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED', 'CANCELLED', 'DUPLICATE') NULL,
    MODIFY `newStatus` ENUM('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR', 'ESCALATED', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED', 'CANCELLED', 'DUPLICATE') NULL;

CREATE TABLE `TicketComment` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `editedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketComment_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    INDEX `TicketComment_authorId_createdAt_idx`(`authorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TicketAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `commentId` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `thumbnailUrl` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketAttachment_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    INDEX `TicketAttachment_commentId_idx`(`commentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TicketAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,

    INDEX `TicketAssignment_ticketId_endedAt_idx`(`ticketId`, `endedAt`),
    INDEX `TicketAssignment_assignedToId_endedAt_idx`(`assignedToId`, `endedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TicketEscalation` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `fromLevel` ENUM('FACILITY', 'LGA', 'STATE', 'ZONE', 'NATIONAL', 'PLATFORM') NOT NULL,
    `toLevel` ENUM('FACILITY', 'LGA', 'STATE', 'ZONE', 'NATIONAL', 'PLATFORM') NOT NULL,
    `reason` TEXT NOT NULL,
    `automatic` BOOLEAN NOT NULL DEFAULT false,
    `escalatedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketEscalation_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    INDEX `TicketEscalation_toLevel_createdAt_idx`(`toLevel`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TicketSequence` (
    `year` INTEGER NOT NULL,
    `currentValue` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MaintenanceTicket`
    ADD CONSTRAINT `MaintenanceTicket_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `MaintenanceTicket_administrativeUnitId_fkey` FOREIGN KEY (`administrativeUnitId`) REFERENCES `AdministrativeUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `TicketActivity`
    ADD CONSTRAINT `TicketActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `TicketComment`
    ADD CONSTRAINT `TicketComment_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `MaintenanceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `TicketComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `TicketAttachment`
    ADD CONSTRAINT `TicketAttachment_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `MaintenanceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `TicketAttachment_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `TicketComment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `TicketAttachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `TicketAssignment`
    ADD CONSTRAINT `TicketAssignment_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `MaintenanceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `TicketAssignment_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `TicketAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `TicketEscalation`
    ADD CONSTRAINT `TicketEscalation_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `MaintenanceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `TicketEscalation_escalatedById_fkey` FOREIGN KEY (`escalatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
