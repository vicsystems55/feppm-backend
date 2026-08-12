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
      const extension = extensions.get(file.mimetype)
        ?? path.extname(file.originalname).toLowerCase();
      callback(null, `ticket-${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_request, file, callback) {
    if (!extensions.has(file.mimetype)) {
      const error = new Error('Ticket attachments must be JPEG, PNG, or WebP images.');
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
}).single('photo');

export function uploadTicketImage(request, response, next) {
  upload(request, response, (error) => {
    if (error) {
      error.status = error.status ?? 400;
      return next(error);
    }
    return next();
  });
}
