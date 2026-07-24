import { Router } from 'express';
import { archiveTemplate, createTemplate, listEquipmentTypes, listMyChecklistTasks, listTemplates, publishTemplate, startChecklistTask, submitChecklistTask, unarchiveTemplate, updateTemplate } from '../controllers/checklistController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.get('/equipment-types', requireRole('SUPER_ADMIN'), listEquipmentTypes);
router.get('/templates', requireRole('SUPER_ADMIN'), listTemplates);
router.post('/templates', requireRole('SUPER_ADMIN'), createTemplate);
router.put('/templates/:id', requireRole('SUPER_ADMIN'), updateTemplate);
router.post('/templates/:id/publish', requireRole('SUPER_ADMIN'), publishTemplate);
router.post('/templates/:id/archive', requireRole('SUPER_ADMIN'), archiveTemplate);
router.post('/templates/:id/unarchive', requireRole('SUPER_ADMIN'), unarchiveTemplate);
router.get('/my-tasks', requireRole('FACILITY_MANAGER'), listMyChecklistTasks);
router.post('/tasks/:id/start', requireRole('FACILITY_MANAGER'), startChecklistTask);
router.post('/tasks/:id/submit', requireRole('FACILITY_MANAGER'), submitChecklistTask);
export default router;
