import fs from 'node:fs/promises';

import { prisma } from '../lib/prisma.js';

async function discard(file) {
  if (!file?.path) return;
  await fs.unlink(file.path).catch(() => {});
}

async function hasValidImageSignature(file) {
  const handle = await fs.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(12);
    await handle.read(buffer, 0, buffer.length, 0);
    if (file.mimetype === 'image/jpeg') {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (file.mimetype === 'image/png') {
      return buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    }
    if (file.mimetype === 'image/webp') {
      return buffer.subarray(0, 4).toString() === 'RIFF'
        && buffer.subarray(8, 12).toString() === 'WEBP';
    }
    return false;
  } finally {
    await handle.close();
  }
}

export async function uploadChecklistEvidence(request, response) {
  const taskId = request.body?.taskId?.trim();
  const checklistItemId = request.body?.checklistItemId?.trim();

  if (!request.file || !taskId || !checklistItemId) {
    await discard(request.file);
    return response.status(400).json({
      success: false,
      message: 'Photo, task ID, and checklist item ID are required.',
    });
  }

  try {
    if (!await hasValidImageSignature(request.file)) {
      await discard(request.file);
      return response.status(400).json({
        success: false,
        message: 'The uploaded file is not a valid image.',
      });
    }

    const task = await prisma.maintenanceTask.findFirst({
      where: {
        id: taskId,
        assignedUserId: request.authUser.id,
        facilityId: request.authUser.facility?.id ?? '__none__',
        maintenanceSchedule: {
          checklistTemplate: { items: { some: { id: checklistItemId } } },
        },
      },
      select: { id: true },
    });

    if (!task) {
      await discard(request.file);
      return response.status(404).json({
        success: false,
        message: 'Checklist task or evidence question was not found.',
      });
    }

    const origin = `${request.protocol}://${request.get('host')}`;
    const fileUrl = `${origin}/uploads/evidence/${encodeURIComponent(request.file.filename)}`;

    return response.status(201).json({
      success: true,
      message: 'Evidence uploaded successfully.',
      data: {
        fileUrl,
        mimeType: request.file.mimetype,
        size: request.file.size,
      },
    });
  } catch (error) {
    await discard(request.file);
    throw error;
  }
}
