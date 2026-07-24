import { Router } from 'express';

import {
  listNotifications,
  listTaskReminderTargets,
  markAllNotificationsRead,
  markNotificationRead,
  sendTaskReminder,
} from '../controllers/notificationController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.get('/', listNotifications);
router.get(
  '/task-reminder-targets',
  requireRole('SUPER_ADMIN'),
  listTaskReminderTargets,
);
router.post(
  '/task-reminders',
  requireRole('SUPER_ADMIN'),
  sendTaskReminder,
);
router.post('/read-all', markAllNotificationsRead);
router.post('/:id/read', markNotificationRead);

export default router;
