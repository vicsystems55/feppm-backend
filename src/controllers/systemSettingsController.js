import { prisma } from '../lib/prisma.js';

const DEMO_LOGIN_SETTING_KEY = 'SHOW_DEMO_LOGINS';
const DEFAULT_DEMO_LOGIN_VISIBILITY = true;

function demoLoginsEnabled(setting) {
  return typeof setting?.value?.enabled === 'boolean'
    ? setting.value.enabled
    : DEFAULT_DEMO_LOGIN_VISIBILITY;
}

async function findDemoLoginSetting() {
  return prisma.platformSetting.findUnique({
    where: { key: DEMO_LOGIN_SETTING_KEY },
  });
}

export async function getPublicSettings(_request, response) {
  const setting = await findDemoLoginSetting();
  return response.json({
    success: true,
    data: { demoLoginsEnabled: demoLoginsEnabled(setting) },
  });
}

export async function getSystemSettings(_request, response) {
  const setting = await findDemoLoginSetting();
  return response.json({
    success: true,
    data: {
      demoLoginsEnabled: demoLoginsEnabled(setting),
      updatedAt: setting?.updatedAt ?? null,
    },
  });
}

export async function updateDemoLoginVisibility(request, response) {
  if (typeof request.body?.enabled !== 'boolean') {
    return response.status(400).json({
      success: false,
      message: 'The enabled value must be true or false.',
    });
  }

  const enabled = request.body.enabled;
  const setting = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.platformSetting.upsert({
      where: { key: DEMO_LOGIN_SETTING_KEY },
      create: {
        key: DEMO_LOGIN_SETTING_KEY,
        value: { enabled },
        updatedById: request.authUser.id,
      },
      update: {
        value: { enabled },
        updatedById: request.authUser.id,
      },
    });

    await transaction.auditLog.create({
      data: {
        userId: request.authUser.id,
        action: enabled ? 'ENABLE_DEMO_LOGINS' : 'DISABLE_DEMO_LOGINS',
        entityType: 'PlatformSetting',
        entityId: DEMO_LOGIN_SETTING_KEY,
        newValues: { enabled },
        ipAddress: request.ip,
        userAgent: request.get('user-agent')?.slice(0, 500) ?? null,
      },
    });

    return updated;
  });

  return response.json({
    success: true,
    message: `Demo logins ${enabled ? 'enabled' : 'hidden'} successfully.`,
    data: {
      demoLoginsEnabled: enabled,
      updatedAt: setting.updatedAt,
    },
  });
}
