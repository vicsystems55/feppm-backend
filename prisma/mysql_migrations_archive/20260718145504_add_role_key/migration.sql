-- AlterTable
ALTER TABLE `Role` ADD COLUMN `key` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Role_key_key` ON `Role`(`key`);
