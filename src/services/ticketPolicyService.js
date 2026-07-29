const riskOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const priorityMatrix = {
  LOW: { LOW: 4, MEDIUM: 4, HIGH: 3, CRITICAL: 2 },
  MEDIUM: { LOW: 4, MEDIUM: 3, HIGH: 3, CRITICAL: 2 },
  HIGH: { LOW: 3, MEDIUM: 3, HIGH: 2, CRITICAL: 1 },
  CRITICAL: { LOW: 2, MEDIUM: 2, HIGH: 1, CRITICAL: 1 },
};

const workflow = {
  OPEN: ['ACKNOWLEDGED', 'ASSIGNED', 'ESCALATED', 'CANCELLED', 'DUPLICATE'],
  ACKNOWLEDGED: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR', 'ESCALATED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR', 'ESCALATED', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR', 'ESCALATED', 'RESOLVED', 'CANCELLED'],
  WAITING_ON_REPORTER: ['IN_PROGRESS', 'ESCALATED', 'CANCELLED'],
  AWAITING_PARTS: ['IN_PROGRESS', 'ESCALATED', 'CANCELLED'],
  WAITING_ON_VENDOR: ['IN_PROGRESS', 'ESCALATED', 'CANCELLED'],
  ESCALATED: ['ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['VERIFIED', 'REOPENED'],
  VERIFIED: ['CLOSED', 'REOPENED'],
  REOPENED: ['ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
  DUPLICATE: [],
};

const escalationOrder = ['FACILITY', 'LGA', 'STATE', 'ZONE', 'NATIONAL', 'PLATFORM'];

const slaHours = {
  1: { response: 0.25, resolution: 4 },
  2: { response: 1, resolution: 8 },
  3: { response: 4, resolution: 48 },
  4: { response: 24, resolution: 120 },
};

export function normalizeRiskLevel(value, fallback = 'MEDIUM') {
  const normalized = String(value ?? '').trim().toUpperCase();
  return riskOrder.includes(normalized) ? normalized : fallback;
}

export function calculateTicketPriority(impact, urgency) {
  const normalizedImpact = normalizeRiskLevel(impact);
  const normalizedUrgency = normalizeRiskLevel(urgency);
  return priorityMatrix[normalizedImpact][normalizedUrgency];
}

export function deriveTicketSeverity(impact, urgency) {
  const normalizedImpact = normalizeRiskLevel(impact);
  const normalizedUrgency = normalizeRiskLevel(urgency);
  return riskOrder[Math.max(riskOrder.indexOf(normalizedImpact), riskOrder.indexOf(normalizedUrgency))];
}

export function canTransitionTicket(fromStatus, toStatus) {
  if (fromStatus === toStatus) return false;
  return workflow[fromStatus]?.includes(toStatus) ?? false;
}

export function nextEscalationLevel(currentLevel) {
  const index = escalationOrder.indexOf(currentLevel);
  if (index < 0 || index === escalationOrder.length - 1) return null;
  return escalationOrder[index + 1];
}

export function calculateSlaTargets(priority, startedAt = new Date()) {
  const policy = slaHours[priority] ?? slaHours[3];
  return {
    responseDueAt: new Date(startedAt.getTime() + policy.response * 60 * 60 * 1000),
    resolutionDueAt: new Date(startedAt.getTime() + policy.resolution * 60 * 60 * 1000),
  };
}

export function statusTimestampChanges(status, now = new Date()) {
  if (status === 'ACKNOWLEDGED') return { acknowledgedAt: now, firstResponseAt: now };
  if (status === 'IN_PROGRESS') return { workStartedAt: now, slaPausedAt: null };
  if (['WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR'].includes(status)) {
    return { slaPausedAt: now };
  }
  if (status === 'RESOLVED') return { resolvedAt: now, slaPausedAt: null };
  if (status === 'VERIFIED') return { verifiedAt: now };
  if (status === 'CLOSED') return { closedAt: now };
  if (status === 'REOPENED') {
    return {
      resolvedAt: null,
      verifiedAt: null,
      closedAt: null,
      slaPausedAt: null,
    };
  }
  return {};
}

export const ticketStatuses = Object.freeze(Object.keys(workflow));
export const ticketEscalationLevels = Object.freeze(escalationOrder);
