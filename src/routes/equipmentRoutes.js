import { Router } from 'express';

import { getLgaEquipment, listLgaEquipment } from '../controllers/lgaOperationsController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requirePermission('equipment.view'));
router.get('/', listLgaEquipment);
router.get('/:id', getLgaEquipment);

export default router;
