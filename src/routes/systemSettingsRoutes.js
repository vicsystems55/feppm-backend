import { Router } from 'express';

import {
  getPublicSettings,
  getSystemSettings,
  updateDemoLoginVisibility,
} from '../controllers/systemSettingsController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/public', getPublicSettings);
router.use(authenticate, requireRole('SUPER_ADMIN'));
router.get('/', getSystemSettings);
router.patch('/demo-logins', updateDemoLoginVisibility);

export default router;
