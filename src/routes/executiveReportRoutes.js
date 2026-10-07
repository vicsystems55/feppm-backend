import { Router } from 'express';

import { exportStateExecutiveReport, getStateExecutiveReport } from '../controllers/executiveReportController.js';
import { authenticate } from '../middleware/auth.js';
import { userHasRole } from '../services/userAccessService.js';

const router = Router();
const allowedRoles = ['STATE_ADMIN', 'WORKSHOP_MANAGER', 'STATE_MAINTENANCE_MANAGER'];

router.use(authenticate, (request, response, next) => {
  if (!allowedRoles.some((role) => userHasRole(request.authUser, role))) {
    return response.status(403).json({ success: false, message: 'Executive reports are available to authorized state operations roles.' });
  }
  return next();
});
router.get('/', getStateExecutiveReport);
router.get('/export', exportStateExecutiveReport);

export default router;
