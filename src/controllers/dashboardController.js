import { prisma } from '../lib/prisma.js';
import { ensureManagerTasks } from './checklistController.js';
import { resolveFacilityAccess } from '../services/facilityAccessService.js';

const rolePriority = ['SUPER_ADMIN', 'NATIONAL_ADMIN', 'ZONAL_ADMIN', 'STATE_ADMIN', 'LGA_ADMIN', 'FACILITY_MANAGER'];
const completedStatuses = ['COMPLETED_ON_TIME', 'COMPLETED_LATE'];
const openTicketStatuses = ['OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'REOPENED'];

function primaryRole(user) {
  const keys = new Set(user.roles.map(({ role }) => role.key));
  return rolePriority.find((key) => keys.has(key));
}

function percentage(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 100) : null;
}

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function targetUnitType(roleKey) {
  return { NATIONAL_ADMIN: 'ZONE', ZONAL_ADMIN: 'STATE', STATE_ADMIN: 'LGA' }[roleKey] ?? null;
}

function findAncestor(unit, type) {
  let current = unit;
  while (current) {
    if (current.type === type) return current;
    current = current.parent;
  }
  return null;
}

function buildBreakdown(facilities, roleKey) {
  const groups = new Map();
  for (const facility of facilities) {
    let key;
    let name;
    if (roleKey === 'SUPER_ADMIN') {
      key = facility.organization.id;
      name = facility.organization.name;
    } else if (roleKey === 'LGA_ADMIN' || roleKey === 'FACILITY_MANAGER') {
      key = facility.id;
      name = facility.name;
    } else {
      const unit = findAncestor(facility.administrativeUnit, targetUnitType(roleKey));
      if (!unit) continue;
      key = unit.id;
      name = unit.name;
    }
    const group = groups.get(key) ?? { id: key, name, facilities: 0, activeFacilities: 0, equipment: 0 };
    group.facilities += 1;
    group.activeFacilities += facility.status === 'ACTIVE' ? 1 : 0;
    group.equipment += facility._count.equipment;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, score: percentage(group.activeFacilities, group.facilities) }))
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.name.localeCompare(right.name));
}

function maintenanceTrend(tasks) {
  const formatter = new Intl.DateTimeFormat('en', { month: 'short' });
  const months = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - offset);
    months.push({ key: `${date.getFullYear()}-${date.getMonth()}`, label: formatter.format(date), completed: 0, overdue: 0, missed: 0 });
  }
  const byKey = new Map(months.map((month) => [month.key, month]));
  for (const task of tasks) {
    const bucket = byKey.get(`${task.dueAt.getFullYear()}-${task.dueAt.getMonth()}`);
    if (!bucket) continue;
    if (completedStatuses.includes(task.status)) bucket.completed += 1;
    if (task.status === 'OVERDUE') bucket.overdue += 1;
    if (task.status === 'MISSED') bucket.missed += 1;
  }
  return months;
}

export async function getDashboard(request, response) {
  const roleKey = primaryRole(request.authUser);
  if (roleKey === 'FACILITY_MANAGER') {
    await ensureManagerTasks(request.authUser, 'DAILY');
  }
  const access = await resolveFacilityAccess(request.authUser);
  const { start, end } = dayBounds();
  const twelveMonthsAgo = new Date(start);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  const facilityRelation = { facility: access.facilityWhere };

  const [
    facilities,
    equipmentStatus,
    activeUsers,
    tasksToday,
    overdueTasks,
    openWorkOrders,
    criticalAlerts,
    recentAlerts,
    trendTasks,
    myTasks,
    reward,
    dailyLogins,
    devices,
  ] = await Promise.all([
    prisma.facility.findMany({
      where: access.facilityWhere,
      select: {
        id: true, name: true, status: true,
        organization: { select: { id: true, name: true } },
        administrativeUnit: {
          select: {
            id: true, name: true, type: true,
            parent: { select: { id: true, name: true, type: true, parent: { select: { id: true, name: true, type: true, parent: { select: { id: true, name: true, type: true } } } } } },
          },
        },
        _count: { select: { equipment: true, tasks: true, alerts: true } },
      },
    }),
    prisma.equipment.groupBy({ by: ['functionalityStatus'], where: facilityRelation, _count: { _all: true } }),
    prisma.user.count({ where: roleKey === 'SUPER_ADMIN' ? { status: 'ACTIVE' } : { organizationId: request.authUser.organization.id, status: 'ACTIVE' } }),
    prisma.maintenanceTask.groupBy({
      by: ['status'],
      where: { ...facilityRelation, scheduledAt: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    prisma.maintenanceTask.count({ where: { ...facilityRelation, status: { in: ['OVERDUE', 'MISSED'] } } }),
    prisma.maintenanceTicket.count({ where: { ...facilityRelation, status: { in: openTicketStatuses } } }),
    prisma.alert.count({ where: { ...facilityRelation, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'CRITICAL' } }),
    prisma.alert.findMany({
      where: { ...facilityRelation, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      orderBy: { triggeredAt: 'desc' },
      take: 6,
      select: { id: true, title: true, message: true, severity: true, triggeredAt: true, facility: { select: { name: true } }, equipment: { select: { assetCode: true } } },
    }),
    prisma.maintenanceTask.findMany({ where: { ...facilityRelation, dueAt: { gte: twelveMonthsAgo } }, select: { dueAt: true, status: true } }),
    prisma.maintenanceTask.findMany({
      where: {
        assignedUserId: request.authUser.id,
        ...facilityRelation,
        scheduledAt: { gte: start, lt: end },
      },
      orderBy: { dueAt: 'asc' },
      take: 8,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        dueAt: true,
        equipment: {
          select: {
            assetCode: true,
            equipmentType: { select: { name: true } },
          },
        },
        facility: {
          select: { name: true, latitude: true, longitude: true },
        },
        maintenanceSchedule: {
          select: {
            checklistTemplate: {
              select: {
                name: true,
                estimatedDurationMinutes: true,
                items: { orderBy: { sequenceOrder: 'asc' } },
              },
            },
          },
        },
      },
    }),
    prisma.rewardAccount.findUnique({
      where: { userId: request.authUser.id },
      include: {
        currentLevel: true,
        user: {
          select: {
            badges: {
              include: { badge: true },
              orderBy: { earnedAt: 'desc' },
            },
          },
        },
      },
    }),
    prisma.user.count({ where: { lastLoginAt: { gte: start, lt: end } } }),
    prisma.registeredDevice.findMany({ select: { lastSeenAt: true, isTrusted: true } }),
  ]);

  const equipment = Object.fromEntries(equipmentStatus.map((item) => [item.functionalityStatus, item._count._all]));
  const totalEquipment = equipmentStatus.reduce((sum, item) => sum + item._count._all, 0);
  const operationalEquipment = equipment.FUNCTIONAL ?? 0;
  const today = Object.fromEntries(tasksToday.map((item) => [item.status, item._count._all]));
  const todayTotal = tasksToday.reduce((sum, item) => sum + item._count._all, 0);
  const todayCompleted = completedStatuses.reduce((sum, key) => sum + (today[key] ?? 0), 0);
  const offlineThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const scope = request.auth.scopes?.[0] ?? request.auth.facility ?? request.auth.organization;

  return response.json({
    success: true,
    data: {
      roleKey,
      scope,
      generatedAt: new Date().toISOString(),
      summary: {
        facilities: facilities.length,
        activeFacilities: facilities.filter((facility) => facility.status === 'ACTIVE').length,
        equipment: totalEquipment,
        activeUsers,
        operationalEquipment,
        equipmentHealth: percentage(operationalEquipment, totalEquipment),
        tasksToday: todayTotal,
        completedToday: todayCompleted,
        inProgressToday: today.IN_PROGRESS ?? 0,
        pendingToday: (today.DUE ?? 0) + (today.UPCOMING ?? 0),
        overdueTasks,
        openWorkOrders,
        criticalAlerts,
        compliance: percentage(todayCompleted, todayTotal),
      },
      equipmentStatus: {
        operational: equipment.FUNCTIONAL ?? 0,
        underMaintenance: equipment.UNDER_REPAIR ?? 0,
        faulty: (equipment.NON_FUNCTIONAL ?? 0) + (equipment.PARTIALLY_FUNCTIONAL ?? 0),
        decommissioned: equipment.DECOMMISSIONED ?? 0,
        offline: equipment.UNKNOWN ?? 0,
      },
      breakdown: buildBreakdown(facilities, roleKey),
      maintenanceTrend: maintenanceTrend(trendTasks),
      recentAlerts,
      myTasks,
      reward: reward ? {
        points: reward.totalCredits,
        credits: reward.totalCredits,
        lifetimePoints: reward.lifetimeCredits,
        streakDays: reward.currentStreakDays,
        longestStreakDays: reward.longestStreakDays,
        lastStreakDate: reward.lastStreakDate,
        level: reward.currentLevel?.name ?? 'Starter',
        levelMinimumPoints: reward.currentLevel?.minimumCredits ?? 0,
        nextLevelPoints: reward.currentLevel?.maximumCredits == null
          ? null
          : reward.currentLevel.maximumCredits + 1,
        pointsToNextLevel: reward.currentLevel?.maximumCredits == null
          ? 0
          : Math.max(0, (reward.currentLevel.maximumCredits + 1) - reward.totalCredits),
        badges: reward.user.badges.map(({ badge, earnedAt }) => ({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          earnedAt,
        })),
      } : {
        points: 0,
        credits: 0,
        lifetimePoints: 0,
        streakDays: 0,
        longestStreakDays: 0,
        lastStreakDate: null,
        level: 'Starter',
        levelMinimumPoints: 0,
        nextLevelPoints: 100,
        pointsToNextLevel: 100,
        badges: [],
      },
      platform: {
        dailyLogins,
        registeredDevices: devices.length,
        offlineDevices: devices.filter((device) => !device.lastSeenAt || device.lastSeenAt < offlineThreshold).length,
        trustedDevices: devices.filter((device) => device.isTrusted).length,
      },
    },
  });
}
