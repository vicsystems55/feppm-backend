-- AlterTable
ALTER TABLE `Facility` MODIFY `ownershipType` ENUM('FEDERAL', 'STATE', 'LGA', 'PUBLIC', 'PRIVATE', 'NGO', 'FAITH_BASED', 'OTHER') NULL;

-- CreateTable
CREATE TABLE `FacilityContact` (
    `id` VARCHAR(191) NOT NULL,
    `facilityId` VARCHAR(191) NOT NULL,
    `contactKey` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `jobTitle` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `normalizedPhone` VARCHAR(191) NULL,
    `isPhoneValid` BOOLEAN NOT NULL DEFAULT false,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(191) NULL,
    `sourceRowNumber` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FacilityContact_normalizedPhone_idx`(`normalizedPhone`),
    UNIQUE INDEX `FacilityContact_facilityId_contactKey_key`(`facilityId`, `contactKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FacilityContact` ADD CONSTRAINT `FacilityContact_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
