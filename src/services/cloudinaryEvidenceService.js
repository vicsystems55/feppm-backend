import fs from 'node:fs/promises';

import { env } from '../config/env.js';

export async function uploadEvidenceToCloudinary(file) {
  if (!env.cloudinaryCloudName || !env.cloudinaryUploadPreset) {
    const error = new Error(
      'Cloudinary evidence storage is not configured on the backend.',
    );
    error.status = 503;
    throw error;
  }

  const bytes = await fs.readFile(file.path);
  const data = new FormData();
  data.append(
    'file',
    new Blob([bytes], { type: file.mimetype }),
    file.originalname || file.filename,
  );
  data.append('upload_preset', env.cloudinaryUploadPreset);
  data.append('folder', env.cloudinaryUploadFolder);
  data.append('tags', 'feppm,checklist-evidence,mobile-verified');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.cloudinaryCloudName)}/image/upload`,
    {
      method: 'POST',
      body: data,
      signal: AbortSignal.timeout(60_000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.secure_url) {
    const error = new Error(
      payload?.error?.message
        || 'Cloudinary did not accept the evidence image.',
    );
    error.status = 502;
    throw error;
  }

  return {
    fileUrl: payload.secure_url,
    thumbnailUrl: payload.secure_url,
    publicId: payload.public_id,
    width: payload.width,
    height: payload.height,
    bytes: payload.bytes,
    format: payload.format,
  };
}
