import { Router } from 'express';
import {
  cancelResourceRequest,
  createResourceRequest,
  getResourceRequest,
  getResourceRequestOptions,
  listResourceRequests,
  reviewResourceRequestByStore,
  reviewResourceRequestByWorkshop,
} from '../controllers/resourceRequestController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requirePermission('resource_requests.view'));
router.get('/', listResourceRequests);
router.get('/options', getResourceRequestOptions);
router.get('/:id', getResourceRequest);
router.post('/', requirePermission('resource_requests.create'), createResourceRequest);
router.post('/:id/workshop-review', requirePermission('resource_requests.review'), reviewResourceRequestByWorkshop);
router.post('/:id/store-review', requirePermission('resource_requests.fulfill'), reviewResourceRequestByStore);
router.post('/:id/cancel', requirePermission('resource_requests.create'), cancelResourceRequest);

export default router;
