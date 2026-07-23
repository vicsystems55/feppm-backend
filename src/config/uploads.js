import path from 'node:path';

export const evidenceUploadDirectory = path.resolve(
  process.env.EVIDENCE_UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'evidence'),
);
