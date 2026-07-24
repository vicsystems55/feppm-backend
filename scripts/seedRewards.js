import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const levels = [
  { name: 'Starter', minimumCredits: 0, maximumCredits: 99 },
  { name: 'Bronze', minimumCredits: 100, maximumCredits: 249 },
  { name: 'Silver', minimumCredits: 250, maximumCredits: 499 },
  { name: 'Gold', minimumCredits: 500, maximumCredits: 999 },
  { name: 'Champion', minimumCredits: 1000, maximumCredits: null },
];

const badges = [
  ['Starter', 'Completed the first daily preventive-maintenance task.', 'sparkles'],
  ['3-Day Streak', 'Completed daily preventive-maintenance tasks for three consecutive days.', 'flame'],
  ['7-Day Streak', 'Maintained preventive-maintenance activity for seven consecutive days.', 'award'],
  ['30-Day Champion', 'Maintained preventive-maintenance activity for thirty consecutive days.', 'trophy'],
  ['100 Point Club', 'Earned the first one hundred FEPPM reward points.', 'star'],
];

async function main() {
  for (const level of levels) {
    await prisma.rewardLevel.upsert({
      where: { name: level.name },
      update: level,
      create: level,
    });
  }

  await prisma.rewardRule.upsert({
    where: { activityType: 'DAILY_TASK_COMPLETED' },
    update: {
      creditValue: 10,
      penaltyValue: 0,
      requiresApproval: false,
      active: true,
    },
    create: {
      activityType: 'DAILY_TASK_COMPLETED',
      creditValue: 10,
      penaltyValue: 0,
      requiresApproval: false,
      active: true,
    },
  });

  for (const [name, description, icon] of badges) {
    await prisma.badge.upsert({
      where: { name },
      update: { description, icon },
      create: { name, description, icon },
    });
  }

  console.log(`Seeded ${levels.length} reward levels, 1 daily-task rule, and ${badges.length} badges.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
