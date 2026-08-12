import { Router } from 'express';

import authRouter from './authRoutes.js';
import adminAccountRouter from './adminAccountRoutes.js';
import dashboardRouter from './dashboardRoutes.js';
import checklistRouter from './checklistRoutes.js';
import facilityRouter from './facilityRoutes.js';
import lgaReportRouter from './lgaReportRoutes.js';
import maintenanceOperationsRouter from './maintenanceOperationsRoutes.js';
import notificationRouter from './notificationRoutes.js';
import ticketRouter from './ticketRoutes.js';
import uploadRouter from './uploadRoutes.js';

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
router.use('/lga', lgaReportRouter);
router.use('/maintenance-operations', maintenanceOperationsRouter);
router.use('/notifications', notificationRouter);
router.use('/tickets', ticketRouter);
router.use('/uploads', uploadRouter);

export default router;
