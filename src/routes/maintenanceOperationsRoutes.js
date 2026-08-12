import { Router } from 'express';
import {
  createVendorContract,
  createMaintenanceVendor,
  createWorkOrderFromRequest,
  getMaintenanceDashboard,
  getMaintenanceOptions,
  getMaintenanceRequest,
  listMaintenanceRequests,
  listMaintenanceSkills,
  listMaintenanceWorkOrders,
  listTechnicians,
  listVendorContracts,
  triageMaintenanceRequest,
  updateVendorContract,
  upsertTechnician,
} from '../controllers/maintenanceOperationsController.js';
import { authenticate, requireAnyPermission, requirePermission } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requirePermission('maintenance_operations.view'));
router.get('/dashboard', getMaintenanceDashboard);
router.get('/requests', listMaintenanceRequests);
router.get('/requests/:ticketId', getMaintenanceRequest);
router.put('/requests/:ticketId/triage', requirePermission('maintenance_requests.triage'), triageMaintenanceRequest);
router.post('/requests/:ticketId/work-orders', requirePermission('work_orders.create'), createWorkOrderFromRequest);
router.get('/work-orders', requirePermission('work_orders.view'), listMaintenanceWorkOrders);
router.get('/skills', requirePermission('technicians.view'), listMaintenanceSkills);
router.get('/technicians', requirePermission('technicians.view'), listTechnicians);
router.post('/technicians', requirePermission('technicians.manage'), upsertTechnician);
router.get('/vendor-contracts', requirePermission('vendor_contracts.view'), listVendorContracts);
router.post('/vendors', requirePermission('vendor_contracts.manage'), createMaintenanceVendor);
router.post('/vendor-contracts', requirePermission('vendor_contracts.manage'), createVendorContract);
router.put('/vendor-contracts/:id', requirePermission('vendor_contracts.manage'), updateVendorContract);
router.get('/options', requireAnyPermission('technicians.manage', 'vendor_contracts.manage', 'work_orders.create'), getMaintenanceOptions);
export default router;
