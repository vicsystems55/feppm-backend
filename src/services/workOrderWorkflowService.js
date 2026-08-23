export const WORK_ORDER_TRANSITIONS = Object.freeze({
  submit: { from: ['DRAFT'], to: 'PENDING_APPROVAL' },
  approve: { from: ['PENDING_APPROVAL'], to: 'APPROVED' },
  assign: { from: ['APPROVED', 'ASSIGNED'], to: 'ASSIGNED' },
  start: { from: ['ASSIGNED'], to: 'IN_PROGRESS' },
  request_parts: { from: ['IN_PROGRESS'], to: 'AWAITING_PARTS' },
  resume: { from: ['AWAITING_PARTS'], to: 'IN_PROGRESS' },
  submit_completion: { from: ['IN_PROGRESS'], to: 'AWAITING_VERIFICATION' },
  verify: { from: ['AWAITING_VERIFICATION'], to: 'COMPLETED' },
  return: { from: ['AWAITING_VERIFICATION'], to: 'IN_PROGRESS' },
  cancel: { from: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ASSIGNED'], to: 'CANCELLED' },
});

export function resolveWorkOrderTransition(action, currentStatus, { hasAssignment = false } = {}) {
  const normalizedAction = String(action ?? '').trim().toLowerCase();
  const transition = WORK_ORDER_TRANSITIONS[normalizedAction];
  if (!transition || !transition.from.includes(currentStatus)) {
    const error = new Error(`Work order cannot perform ${normalizedAction || 'this action'} while ${String(currentStatus).toLowerCase().replaceAll('_', ' ')}.`);
    error.status = 409;
    throw error;
  }
  if (normalizedAction === 'approve' && hasAssignment) return 'ASSIGNED';
  return transition.to;
}

export function isTerminalWorkOrderStatus(status) {
  return status === 'COMPLETED' || status === 'CANCELLED';
}
