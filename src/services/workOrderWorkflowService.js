export const WORK_ORDER_TRANSITIONS = Object.freeze({
  submit: { from: ['DRAFT'], to: 'PENDING_APPROVAL' },
  approve: { from: ['PENDING_APPROVAL'], to: 'APPROVED' },
  assign: { from: ['APPROVED', 'ASSIGNED'], to: 'ASSIGNED' },
  accept: { from: ['ASSIGNED'], to: 'ACCEPTED' },
  start: { from: ['ACCEPTED'], to: 'IN_PROGRESS' },
  request_parts: { from: ['IN_PROGRESS'], to: 'AWAITING_PARTS' },
  resume: { from: ['AWAITING_PARTS'], to: 'IN_PROGRESS' },
  submit_completion: { from: ['IN_PROGRESS'], to: 'AWAITING_VERIFICATION' },
  verify: { from: ['AWAITING_VERIFICATION'], to: 'COMPLETED' },
  return: { from: ['AWAITING_VERIFICATION'], to: 'IN_PROGRESS' },
  cancel: { from: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ASSIGNED', 'ACCEPTED'], to: 'CANCELLED' },
});

export function resolveWorkOrderTransition(action, currentStatus) {
  const normalizedAction = String(action ?? '').trim().toLowerCase();
  const transition = WORK_ORDER_TRANSITIONS[normalizedAction];
  if (!transition || !transition.from.includes(currentStatus)) {
    const error = new Error(`Work order cannot perform ${normalizedAction || 'this action'} while ${String(currentStatus).toLowerCase().replaceAll('_', ' ')}.`);
    error.status = 409;
    throw error;
  }
  return transition.to;
}

export function isTerminalWorkOrderStatus(status) {
  return status === 'COMPLETED' || status === 'CANCELLED';
}
