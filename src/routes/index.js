import { Router } from 'express';

import authRouter from './authRoutes.js';
import adminAccountRouter from './adminAccountRoutes.js';
import dashboardRouter from './dashboardRoutes.js';
import checklistRouter from './checklistRoutes.js';
import facilityRouter from './facilityRoutes.js';

const router = Router();

export function healthCheck(_request, response) {
  response.json({
    success: true,
    message: 'FEPPM API is healthy',
    timestamp: new Date().toISOString(),
  });
}

router.get('/health', healthCheck);
router.use('/auth', authRouter);
router.use('/admin', adminAccountRouter);
router.use('/dashboard', dashboardRouter);
router.use('/checklists', checklistRouter);
router.use('/facilities', facilityRouter);

export default router;
