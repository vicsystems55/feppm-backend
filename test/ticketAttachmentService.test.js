import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_TICKET_ATTACHMENTS,
  normalizeTicketAttachments,
} from '../src/services/ticketAttachmentService.js';

const cloudName = 'feppm-cloud';
const validAttachment = {
  fileUrl: `https://res.cloudinary.com/${cloudName}/image/upload/v123/feppm/tickets/fault.jpg`,
  thumbnailUrl: `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,w_480/v123/feppm/tickets/fault.jpg`,
  fileName: 'fault.jpg',
  mimeType: 'image/jpeg',
  fileSize: 2048,
};

test('normalizes valid Cloudinary ticket image metadata', () => {
  assert.deepEqual(
    normalizeTicketAttachments([validAttachment], { cloudName }),
    [validAttachment],
  );
});

test('rejects an attachment hosted outside the configured Cloudinary cloud', () => {
  assert.throws(
    () => normalizeTicketAttachments([
      { ...validAttachment, fileUrl: 'https://example.com/fault.jpg' },
    ], { cloudName }),
    /configured Cloudinary account/,
  );
});

test('rejects oversized ticket images', () => {
  assert.throws(
    () => normalizeTicketAttachments([
      { ...validAttachment, fileSize: (10 * 1024 * 1024) + 1 },
    ], { cloudName }),
    /10 MB or smaller/,
  );
});

test('limits the number of ticket images submitted at once', () => {
  const attachments = Array.from(
    { length: MAX_TICKET_ATTACHMENTS + 1 },
    (_, index) => ({
      ...validAttachment,
      fileUrl: validAttachment.fileUrl.replace('fault.jpg', `fault-${index}.jpg`),
    }),
  );
  assert.throws(
    () => normalizeTicketAttachments(attachments, { cloudName }),
    /maximum of 5 images/,
  );
});
