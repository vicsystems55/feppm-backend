import fs from 'node:fs/promises';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import {
  createEvidenceToken,
  distanceMeters,
} from '../services/evidenceVerificationService.js';

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
  const latitude = Number(request.body?.latitude);
  const longitude = Number(request.body?.longitude);
  const gpsAccuracy = Number(request.body?.gpsAccuracy);
  const capturedAt = new Date(request.body?.capturedAt);

  if (
    !request.file
    || !taskId
    || !checklistItemId
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
    || !Number.isFinite(gpsAccuracy)
    || Number.isNaN(capturedAt.getTime())
  ) {
    await discard(request.file);
    return response.status(400).json({
      success: false,
      message:
        'Photo, task, capture time, and a valid current GPS position are required.',
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
      select: {
        id: true,
        facility: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!task) {
      await discard(request.file);
      return response.status(404).json({
        success: false,
        message: 'Checklist task or evidence question was not found.',
      });
    }

    const facilityLatitude = Number(task.facility.latitude);
    const facilityLongitude = Number(task.facility.longitude);
    if (
      !Number.isFinite(facilityLatitude)
      || !Number.isFinite(facilityLongitude)
    ) {
      await discard(request.file);
      return response.status(422).json({
        success: false,
        message:
          'This facility does not have valid registered coordinates. Contact an administrator.',
      });
    }

    if (
      gpsAccuracy <= 0
      || gpsAccuracy > env.evidenceMaxGpsAccuracyMeters
    ) {
      await discard(request.file);
      return response.status(422).json({
        success: false,
        message:
          `GPS accuracy must be within ${env.evidenceMaxGpsAccuracyMeters} metres. Move outdoors and try again.`,
      });
    }

    const distanceFromFacilityMeters = distanceMeters(
      latitude,
      longitude,
      facilityLatitude,
      facilityLongitude,
    );
    if (distanceFromFacilityMeters > env.evidenceGeofenceRadiusMeters) {
      await discard(request.file);
      return response.status(403).json({
        success: false,
        message:
          `Photo evidence must be captured within ${env.evidenceGeofenceRadiusMeters} metres of ${task.facility.name}. Current distance is ${Math.round(distanceFromFacilityMeters)} metres.`,
      });
    }

    const origin = `${request.protocol}://${request.get('host')}`;
    const fileUrl = `${origin}/uploads/evidence/${encodeURIComponent(request.file.filename)}`;
    const userName = [
      request.authUser.firstName,
      request.authUser.lastName,
    ].filter(Boolean).join(' ') || request.authUser.email;
    const watermarkData = {
      facilityId: task.facility.id,
      facilityName: task.facility.name,
      facilityLatitude,
      facilityLongitude,
      userId: request.authUser.id,
      userName,
      userEmail: request.authUser.email,
      capturedAt: capturedAt.toISOString(),
      latitude,
      longitude,
      gpsAccuracy,
      distanceFromFacilityMeters: Math.round(distanceFromFacilityMeters * 100) / 100,
    };
    const verified = {
      taskId,
      checklistItemId,
      userId: request.authUser.id,
      fileUrl,
      capturedAt: capturedAt.toISOString(),
      latitude,
      longitude,
      gpsAccuracy,
      distanceFromFacilityMeters: watermarkData.distanceFromFacilityMeters,
      capturedOffline: request.body?.capturedOffline === 'true',
      watermarkData,
    };
    const verificationToken = createEvidenceToken(verified);

    return response.status(201).json({
      success: true,
      message: 'Evidence uploaded successfully.',
      data: {
        fileUrl,
        mimeType: request.file.mimetype,
        size: request.file.size,
        ...verified,
        verificationToken,
      },
    });
  } catch (error) {
    await discard(request.file);
    throw error;
  }
}
