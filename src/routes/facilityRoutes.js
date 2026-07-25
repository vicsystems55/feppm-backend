import { Router } from 'express';

import { getFacility, getFacilityTree, listFacilities } from '../controllers/facilityController.js';
import { authenticate, requirePermission, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requirePermission('facilities.view'));
router.get('/', listFacilities);
router.get('/tree', requireRole('SUPER_ADMIN'), getFacilityTree);
router.get('/:id', getFacility);

export default router;
