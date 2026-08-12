ALTER TABLE `RewardAccount`
  ADD COLUMN `longestStreakDays` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lastStreakDate` DATETIME(3) NULL;

CREATE UNIQUE INDEX `RewardTransaction_activityType_referenceId_key`
  ON `RewardTransaction`(`activityType`, `referenceId`);
