const returnableStatuses = new Set(['ISSUED', 'IN_USE', 'UNDER_REPAIR']);
const auditableConditions = new Set(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'UNSERVICEABLE']);

export function assertToolCanBeIssued(asset) {
  if (asset.status !== 'AVAILABLE' || asset.currentCustodianId) {
    const error = new Error('This tool is not currently available for issue.');
    error.status = 409;
    throw error;
  }
}

export function assertToolCanBeReturned(asset) {
  if (!returnableStatuses.has(asset.status) || !asset.currentCustodianId) {
    const error = new Error('This tool is not currently issued to a custodian.');
    error.status = 409;
    throw error;
  }
}

export function normalizedToolCondition(value, fallback = 'GOOD') {
  const condition = String(value ?? '').trim().toUpperCase();
  return auditableConditions.has(condition) ? condition : fallback;
}

export function statusAfterReturn(condition) {
  return ['DAMAGED', 'UNSERVICEABLE'].includes(condition) ? 'UNDER_REPAIR' : 'AVAILABLE';
}

export function nextAuditDate(from, intervalMonths = 6) {
  const date = new Date(from);
  date.setUTCMonth(date.getUTCMonth() + Math.max(1, Number(intervalMonths) || 6));
  return date;
}
