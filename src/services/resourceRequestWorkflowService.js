const workshopDecisions = new Set(['APPROVE', 'REJECT']);
const storeDecisions = new Set(['APPROVE', 'AWAITING_STOCK', 'REJECT']);

function workflowError(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function workshopReviewTransition(status, decision) {
  if (status !== 'SUBMITTED') throw workflowError('Only submitted requests can receive workshop review.');
  if (!workshopDecisions.has(decision)) throw workflowError('Workshop review decision is invalid.', 400);
  return decision === 'APPROVE' ? 'WORKSHOP_APPROVED' : 'REJECTED';
}

export function storeReviewTransition(status, decision) {
  if (!['WORKSHOP_APPROVED', 'AWAITING_STOCK'].includes(status)) {
    throw workflowError('This request is not awaiting store review.');
  }
  if (!storeDecisions.has(decision)) throw workflowError('Store review decision is invalid.', 400);
  if (decision === 'APPROVE') return 'APPROVED_FOR_ISSUE';
  if (decision === 'AWAITING_STOCK') return 'AWAITING_STOCK';
  return 'REJECTED';
}

export function assertIndependentReviewer(request, actorId) {
  if (request.requestedById === actorId) throw workflowError('A requester cannot approve their own resource request.', 403);
}

export function assertIndependentStoreReviewer(request, actorId) {
  assertIndependentReviewer(request, actorId);
  if (request.workshopReviewedById === actorId) {
    throw workflowError('The workshop reviewer cannot also authorize the store decision.', 403);
  }
}

export function positiveQuantity(value, { whole = false, maximum = 100000 } = {}) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > maximum || (whole && !Number.isInteger(quantity))) {
    throw workflowError(whole ? 'Tool quantities must be positive whole numbers.' : 'Quantity must be a positive number.', 400);
  }
  return quantity;
}
