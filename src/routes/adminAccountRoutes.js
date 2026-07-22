import { Router } from 'express';

import {
  createAccount,
  getAccessOptions,
  listAccounts,
  updateAccount,
  updateRolePermissions,
} from '../controllers/adminAccountController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireRole('SUPER_ADMIN'));
router.get('/accounts', listAccounts);
router.post('/accounts', createAccount);
router.patch('/accounts/:id', updateAccount);
router.get('/access-options', getAccessOptions);
router.patch('/roles/:id/permissions', updateRolePermissions);

export default router;
