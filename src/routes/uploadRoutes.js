import { Router } from 'express';

import { uploadChecklistEvidence } from '../controllers/uploadController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadEvidenceImage } from '../middleware/evidenceUpload.js';

const router = Router();

router.post(
  '/evidence',
  authenticate,
  requireRole('FACILITY_MANAGER'),
  uploadEvidenceImage,
  uploadChecklistEvidence,
);

export default router;
