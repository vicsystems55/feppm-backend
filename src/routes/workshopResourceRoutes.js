import { Router } from 'express';
import {
  auditWorkshopTool,
  getWorkshopResourceOptions,
  getWorkshopResourceOverview,
  getWorkshopStore,
  issueWorkshopTool,
  listWorkshopTools,
  receiveWorkshopTool,
  returnWorkshopTool,
} from '../controllers/workshopResourceController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.get('/overview', requirePermission('workshops.view'), getWorkshopResourceOverview);
router.get('/stores/:storeId', requirePermission('inventory.view'), getWorkshopStore);
router.get('/tools', requirePermission('tools.view'), listWorkshopTools);
router.get('/options', requirePermission('tools.view'), getWorkshopResourceOptions);
router.post('/tools/receive', requirePermission('inventory.receive'), receiveWorkshopTool);
router.post('/tools/:assetId/issue', requirePermission('tools.issue'), issueWorkshopTool);
router.post('/tools/:assetId/return', requirePermission('tools.return'), returnWorkshopTool);
router.post('/tools/:assetId/audit', requirePermission('inventory.audit'), auditWorkshopTool);

export default router;
