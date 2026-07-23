import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import multer from 'multer';

import { evidenceUploadDirectory } from '../config/uploads.js';

fs.mkdirSync(evidenceUploadDirectory, { recursive: true });

const extensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: evidenceUploadDirectory,
    filename(_request, file, callback) {
      const extension = extensions.get(file.mimetype) ?? path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter(_request, file, callback) {
    if (!extensions.has(file.mimetype)) {
      const error = new Error('Evidence must be a JPEG, PNG, or WebP image.');
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
}).single('photo');

export function uploadEvidenceImage(request, response, next) {
  upload(request, response, (error) => {
    if (error) {
      error.status = error.status ?? 400;
      return next(error);
    }
    return next();
  });
}
