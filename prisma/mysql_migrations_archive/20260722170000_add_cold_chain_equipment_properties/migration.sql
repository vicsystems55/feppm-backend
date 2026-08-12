-- AlterTable
ALTER TABLE `Equipment`
    ADD COLUMN `grossVolumeLitres` DECIMAL(10, 2) NULL,
    ADD COLUMN `netVolumeLitres` DECIMAL(10, 2) NULL,
    ADD COLUMN `hasAlarmSystem` BOOLEAN NULL,
    ADD COLUMN `hasAdequateShelves` BOOLEAN NULL,
    ADD COLUMN `hasCurtain` BOOLEAN NULL,
    ADD COLUMN `downtimeMonths` INTEGER NULL,
    ADD COLUMN `nonFunctionalReason` VARCHAR(191) NULL,
    ADD COLUMN `coolingUnitCount` INTEGER NULL,
    ADD COLUMN `hasContinuousTemperatureMonitor` BOOLEAN NULL,
    ADD COLUMN `hasBuiltInThermometer` BOOLEAN NULL,
    ADD COLUMN `fundingSource` VARCHAR(191) NULL,
    ADD COLUMN `repairHistory` VARCHAR(191) NULL,
    ADD COLUMN `underWarranty` BOOLEAN NULL,
    ADD COLUMN `source` VARCHAR(191) NULL,
    ADD COLUMN `sourceRowNumber` INTEGER NULL;
