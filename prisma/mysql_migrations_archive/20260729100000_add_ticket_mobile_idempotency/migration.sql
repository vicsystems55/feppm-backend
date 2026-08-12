-- Prevent duplicate ticket creation when an offline mobile submission is retried.
ALTER TABLE `MaintenanceTicket`
    ADD COLUMN `clientRequestId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `MaintenanceTicket_reportedById_clientRequestId_key`
    ON `MaintenanceTicket`(`reportedById`, `clientRequestId`);
