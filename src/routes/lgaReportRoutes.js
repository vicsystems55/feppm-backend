import { Router } from 'express';

import {
  exportLgaTaskReports,
  getLgaTaskReport,
  listLgaMedia,
  listLgaTaskReports,
} from '../controllers/lgaReportController.js';
import {
  getLgaEquipment,
  listLgaEquipment,
  listLgaTasks,
} from '../controllers/lgaOperationsController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireRole('LGA_ADMIN'));
router.get('/equipment', listLgaEquipment);
router.get('/equipment/:id', getLgaEquipment);
router.get('/tasks', listLgaTasks);
router.get('/task-reports', listLgaTaskReports);
router.get('/task-reports/export', exportLgaTaskReports);
router.get('/task-reports/:id', getLgaTaskReport);
router.get('/media', listLgaMedia);

export default router;
