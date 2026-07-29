import { env } from '../config/env.js';

export const MAX_TICKET_ATTACHMENTS = 5;
export const MAX_TICKET_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function attachmentError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function clean(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cloudinaryImageUrl(value, cloudName, fieldName) {
  const rawValue = clean(value, 2048);
  if (!rawValue) {
    if (fieldName === 'thumbnailUrl') return null;
    throw attachmentError(400, 'Each attachment must include a secure Cloudinary image URL.');
  }

  let url;
  try {
    url = new URL(rawValue);
  } catch {
    throw attachmentError(400, `The attachment ${fieldName} is invalid.`);
  }

  const expectedPrefix = `/${cloudName}/image/upload/`;
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'res.cloudinary.com'
    || !url.pathname.startsWith(expectedPrefix)
    || url.username
    || url.password
  ) {
    throw attachmentError(
      400,
      `The attachment ${fieldName} must be an image from the configured Cloudinary account.`,
    );
  }

  url.hash = '';
  return url.toString();
}

export function normalizeTicketAttachments(input, {
  cloudName = env.cloudinaryCloudName,
} = {}) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw attachmentError(400, 'Attachments must be supplied as a list.');
  if (!input.length) return [];
  if (input.length > MAX_TICKET_ATTACHMENTS) {
    throw attachmentError(400, `A maximum of ${MAX_TICKET_ATTACHMENTS} images can be attached at once.`);
  }
  if (!cloudName) {
    throw attachmentError(503, 'Cloudinary ticket image storage is not configured on the backend.');
  }

  const seenUrls = new Set();
  return input.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw attachmentError(400, `Attachment ${index + 1} is invalid.`);
    }

    const fileUrl = cloudinaryImageUrl(item.fileUrl, cloudName, 'fileUrl');
    if (seenUrls.has(fileUrl)) throw attachmentError(400, 'The same image cannot be attached more than once.');
    seenUrls.add(fileUrl);

    const thumbnailUrl = cloudinaryImageUrl(
      item.thumbnailUrl || item.fileUrl,
      cloudName,
      'thumbnailUrl',
    );
    const fileName = clean(item.fileName, 255);
    const mimeType = clean(item.mimeType, 100).toLowerCase();
    const fileSize = Number(item.fileSize);

    if (!fileName) throw attachmentError(400, `Attachment ${index + 1} must include a file name.`);
    if (!allowedMimeTypes.has(mimeType)) {
      throw attachmentError(400, `Attachment ${index + 1} must be a JPG, PNG, WebP, HEIC, or HEIF image.`);
    }
    if (!Number.isInteger(fileSize) || fileSize < 1 || fileSize > MAX_TICKET_ATTACHMENT_BYTES) {
      throw attachmentError(400, `Attachment ${index + 1} must be 10 MB or smaller.`);
    }

    return {
      fileUrl,
      thumbnailUrl,
      fileName,
      mimeType,
      fileSize,
    };
  });
}
