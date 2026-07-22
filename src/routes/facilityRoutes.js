import { Router } from 'express';

import { getFacility, listFacilities } from '../controllers/facilityController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requirePermission('facilities.view'));
router.get('/', listFacilities);
router.get('/:id', getFacility);

export default router;
