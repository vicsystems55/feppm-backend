const DAILY_ACTIVITY = 'DAILY_TASK_COMPLETED';
const DEFAULT_DAILY_POINTS = 10;

function localDateKey(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function earnedBadgeNames(streakDays, lifetimePoints) {
  const names = ['Starter'];
  if (streakDays >= 3) names.push('3-Day Streak');
  if (streakDays >= 7) names.push('7-Day Streak');
  if (streakDays >= 30) names.push('30-Day Champion');
  if (lifetimePoints >= 100) names.push('100 Point Club');
  return names;
}

export async function awardDailyTaskCompletion(
  tx,
  {
    userId,
    taskId,
    completedAt = new Date(),
    timezone = 'Africa/Lagos',
  },
) {
  const alreadyAwarded = await tx.rewardTransaction.findFirst({
    where: {
      activityType: DAILY_ACTIVITY,
      referenceId: taskId,
    },
    select: { id: true },
  });
  if (alreadyAwarded) return { awarded: false };

  const rule = await tx.rewardRule.findUnique({
    where: { activityType: DAILY_ACTIVITY },
  });
  if (rule && !rule.active) return { awarded: false };
  const points = rule?.creditValue ?? DEFAULT_DAILY_POINTS;

  const account = await tx.rewardAccount.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const todayKey = localDateKey(completedAt, timezone);
  const yesterday = new Date(completedAt.getTime() - (24 * 60 * 60 * 1000));
  const yesterdayKey = localDateKey(yesterday, timezone);
  const previousKey = account.lastStreakDate
    ? localDateKey(account.lastStreakDate, timezone)
    : null;

  let streakDays = 1;
  if (previousKey === todayKey) {
    streakDays = Math.max(1, account.currentStreakDays);
  } else if (previousKey === yesterdayKey) {
    streakDays = account.currentStreakDays + 1;
  }

  const totalPoints = account.totalCredits + points;
  const lifetimePoints = account.lifetimeCredits + points;
  const longestStreakDays = Math.max(account.longestStreakDays, streakDays);
  const level = await tx.rewardLevel.findFirst({
    where: { minimumCredits: { lte: totalPoints } },
    orderBy: { minimumCredits: 'desc' },
    select: { id: true, name: true },
  });

  await tx.rewardTransaction.create({
    data: {
      rewardAccountId: account.id,
      activityType: DAILY_ACTIVITY,
      referenceType: 'MAINTENANCE_TASK',
      referenceId: taskId,
      credits: points,
      transactionType: 'CREDIT',
      description: 'Daily preventive-maintenance checklist completed.',
    },
  });

  await tx.rewardAccount.update({
    where: { id: account.id },
    data: {
      totalCredits: totalPoints,
      lifetimeCredits: lifetimePoints,
      currentStreakDays: streakDays,
      longestStreakDays,
      lastStreakDate: previousKey === todayKey
        ? account.lastStreakDate
        : completedAt,
      currentLevelId: level?.id ?? account.currentLevelId,
    },
  });

  const badgeRecords = await tx.badge.findMany({
    where: {
      name: {
        in: earnedBadgeNames(streakDays, lifetimePoints),
      },
    },
    select: { id: true, name: true },
  });
  if (badgeRecords.length) {
    await tx.userBadge.createMany({
      data: badgeRecords.map(({ id: badgeId }) => ({ userId, badgeId })),
      skipDuplicates: true,
    });
  }

  return {
    awarded: true,
    points,
    totalPoints,
    streakDays,
    level: level?.name ?? 'Starter',
    badges: badgeRecords.map(({ name }) => name),
  };
}
