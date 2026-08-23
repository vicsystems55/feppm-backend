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
import {
  addWorkOrderEvidence,
  addWorkOrderPart,
  approveWorkOrder,
  assignWorkOrder,
  changeFieldWorkState,
  getMaintenanceWorkOrder,
  removeWorkOrderPart,
  startWorkOrder,
  submitWorkOrderCompletion,
  submitWorkOrderForApproval,
  updateWorkOrderFieldReport,
  verifyWorkOrderCompletion,
} from '../controllers/maintenanceExecutionController.js';

const router = Router();
router.use(authenticate, requirePermission('maintenance_operations.view'));
router.get('/dashboard', getMaintenanceDashboard);
router.get('/requests', listMaintenanceRequests);
router.get('/requests/:ticketId', getMaintenanceRequest);
router.put('/requests/:ticketId/triage', requirePermission('maintenance_requests.triage'), triageMaintenanceRequest);
router.post('/requests/:ticketId/work-orders', requirePermission('work_orders.create'), createWorkOrderFromRequest);
router.get('/work-orders', requirePermission('work_orders.view'), listMaintenanceWorkOrders);
router.get('/work-orders/:workOrderId', requirePermission('work_orders.view'), getMaintenanceWorkOrder);
router.post('/work-orders/:workOrderId/submit', requirePermission('work_orders.create'), submitWorkOrderForApproval);
router.post('/work-orders/:workOrderId/approve', requirePermission('work_orders.verify'), approveWorkOrder);
router.post('/work-orders/:workOrderId/assign', requirePermission('work_orders.assign'), assignWorkOrder);
router.post('/work-orders/:workOrderId/start', requirePermission('work_orders.update'), startWorkOrder);
router.put('/work-orders/:workOrderId/field-report', requirePermission('work_orders.update'), updateWorkOrderFieldReport);
router.post('/work-orders/:workOrderId/parts', requirePermission('work_orders.update'), addWorkOrderPart);
router.delete('/work-orders/:workOrderId/parts/:partId', requirePermission('work_orders.update'), removeWorkOrderPart);
router.post('/work-orders/:workOrderId/evidence', requirePermission('work_orders.update'), addWorkOrderEvidence);
router.post('/work-orders/:workOrderId/field-state', requirePermission('work_orders.update'), changeFieldWorkState);
router.post('/work-orders/:workOrderId/complete', requirePermission('work_orders.resolve'), submitWorkOrderCompletion);
router.post('/work-orders/:workOrderId/verify', requirePermission('work_orders.verify'), verifyWorkOrderCompletion);
router.get('/skills', requirePermission('technicians.view'), listMaintenanceSkills);
router.get('/technicians', requirePermission('technicians.view'), listTechnicians);
router.post('/technicians', requirePermission('technicians.manage'), upsertTechnician);
router.get('/vendor-contracts', requirePermission('vendor_contracts.view'), listVendorContracts);
router.post('/vendors', requirePermission('vendor_contracts.manage'), createMaintenanceVendor);
router.post('/vendor-contracts', requirePermission('vendor_contracts.manage'), createVendorContract);
router.put('/vendor-contracts/:id', requirePermission('vendor_contracts.manage'), updateVendorContract);
router.get('/options', requireAnyPermission('technicians.manage', 'vendor_contracts.manage', 'work_orders.create'), getMaintenanceOptions);
export default router;
