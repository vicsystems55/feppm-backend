import { Router } from 'express';

import {
  addTicketComment,
  assignTicket,
  createTicket,
  escalateTicket,
  getTicketOptions,
  getTicket,
  listTickets,
  updateTicketStatus,
} from '../controllers/ticketController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', requirePermission('tickets.view'), listTickets);
router.get('/options', requirePermission('tickets.create'), getTicketOptions);
router.post('/', requirePermission('tickets.create'), createTicket);
router.get('/:id', requirePermission('tickets.view'), getTicket);
router.patch('/:id/status', requirePermission('tickets.update'), updateTicketStatus);
router.post('/:id/assign', requirePermission('tickets.assign'), assignTicket);
router.post('/:id/escalate', requirePermission('tickets.escalate'), escalateTicket);
router.post('/:id/comments', requirePermission('tickets.update'), addTicketComment);

export default router;
