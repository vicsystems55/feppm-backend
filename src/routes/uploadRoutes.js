import { Router } from 'express';

import {
  uploadChecklistEvidence,
  uploadTicketAttachment,
} from '../controllers/uploadController.js';
import {
  authenticate,
  requireAnyPermission,
  requireRole,
} from '../middleware/auth.js';
import { uploadEvidenceImage } from '../middleware/evidenceUpload.js';
import { uploadTicketImage } from '../middleware/ticketUpload.js';

const router = Router();

router.post(
  '/evidence',
  authenticate,
  requireRole('FACILITY_MANAGER'),
  uploadEvidenceImage,
  uploadChecklistEvidence,
);

router.post(
  '/ticket-attachment',
  authenticate,
  requireAnyPermission('tickets.create', 'tickets.update'),
  uploadTicketImage,
  uploadTicketAttachment,
);

export default router;
