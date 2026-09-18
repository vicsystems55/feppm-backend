import { Router } from 'express';

import {
  createAccount,
  getAccessOptions,
  listAccounts,
  updateAccount,
  updateRolePermissions,
} from '../controllers/adminAccountController.js';
import { authenticate, requireAnyPermission, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/accounts', requireAnyPermission('users.view', 'maintenance_staff.view'), listAccounts);
router.post('/accounts', requireAnyPermission('users.create', 'maintenance_staff.manage'), createAccount);
router.patch('/accounts/:id', requireAnyPermission('users.update', 'maintenance_staff.manage'), updateAccount);
router.get('/access-options', requireAnyPermission('users.view', 'maintenance_staff.view'), getAccessOptions);
router.patch('/roles/:id/permissions', requireRole('SUPER_ADMIN'), updateRolePermissions);

export default router;
