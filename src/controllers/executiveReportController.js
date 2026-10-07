import ExcelJS from 'exceljs';

import { prisma } from '../lib/prisma.js';
import { resolveFacilityAccess } from '../services/facilityAccessService.js';

const completedTaskStatuses = ['COMPLETED_ON_TIME', 'COMPLETED_LATE'];
const notConductedTaskStatuses = ['MISSED', 'OVERDUE'];
const addressedIssueStatuses = ['RESOLVED', 'VERIFIED', 'CLOSED'];

function dateRange(request) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const from = request.query.from ? new Date(`${request.query.from}T00:00:00.000+01:00`) : start;
  const to = request.query.to ? new Date(`${request.query.to}T23:59:59.999+01:00`) : end;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    const error = new Error('Select a valid executive report date range.');
    error.status = 400;
    throw error;
  }
  return { from, to };
}

function ancestorOfType(unitId, type, unitsById) {
  let current = unitsById.get(unitId);
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    if (current.type === type) return current;
    visited.add(current.id);
    current = current.parentId ? unitsById.get(current.parentId) : null;
  }
  return null;
}

function percentage(completed, notConducted) {
  const due = completed + notConducted;
  return due ? Math.round((completed / due) * 10000) / 100 : 0;
}

function safeFilename(value) {
  return String(value || 'State').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');
}

async function buildExecutiveReport(request) {
  const { from, to } = dateRange(request);
  const access = await resolveFacilityAccess(request.authUser);
  const organizationId = request.authUser.organization.id;
  const [facilities, units] = await Promise.all([
    prisma.facility.findMany({
      where: access.facilityWhere,
      select: {
        id: true,
        name: true,
        administrativeUnitId: true,
        _count: { select: { equipment: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.administrativeUnit.findMany({
      where: { organizationId },
      select: { id: true, name: true, type: true, parentId: true },
    }),
  ]);

  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const facilityMeta = new Map();
  for (const facility of facilities) {
    facilityMeta.set(facility.id, {
      lga: ancestorOfType(facility.administrativeUnitId, 'LGA', unitsById),
      state: ancestorOfType(facility.administrativeUnitId, 'STATE', unitsById),
    });
  }
  const facilityIds = facilities.map(({ id }) => id);
  const stateName = [...facilityMeta.values()].find(({ state }) => state)?.state?.name
    ?? request.authUser.scopes?.find(({ administrativeUnit }) => administrativeUnit.type === 'STATE')?.administrativeUnit.name
    ?? request.authUser.organization.name;

  const [managers, taskGroups, issueGroups] = facilityIds.length ? await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId,
        facilityId: { in: facilityIds },
        roles: { some: { role: { key: 'FACILITY_MANAGER' } } },
      },
      select: { id: true, facilityId: true, firstName: true, lastName: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.maintenanceTask.groupBy({
      by: ['facilityId', 'status'],
      where: { facilityId: { in: facilityIds }, scheduledAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.maintenanceTicket.groupBy({
      by: ['facilityId', 'status'],
      where: { facilityId: { in: facilityIds }, reportedAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
  ]) : [[], [], []];

  const lgas = new Map();
  for (const facility of facilities) {
    const lga = facilityMeta.get(facility.id)?.lga;
    if (!lga) continue;
    if (!lgas.has(lga.id)) lgas.set(lga.id, { id: lga.id, name: lga.name, facilities: [] });
    lgas.get(lga.id).facilities.push(facility);
  }

  const taskCounts = new Map();
  for (const item of taskGroups) taskCounts.set(`${item.facilityId}:${item.status}`, item._count._all);
  const issueCounts = new Map();
  for (const item of issueGroups) issueCounts.set(`${item.facilityId}:${item.status}`, item._count._all);

  const rows = [...lgas.values()].sort((a, b) => a.name.localeCompare(b.name)).map((lga) => {
    const ids = new Set(lga.facilities.map(({ id }) => id));
    const majorManager = managers.find((manager) => ids.has(manager.facilityId));
    let conducted = 0;
    let notConducted = 0;
    let issuesRaised = 0;
    let issuesAddressed = 0;
    for (const facility of lga.facilities) {
      for (const status of completedTaskStatuses) conducted += taskCounts.get(`${facility.id}:${status}`) ?? 0;
      for (const status of notConductedTaskStatuses) notConducted += taskCounts.get(`${facility.id}:${status}`) ?? 0;
      for (const status of ['OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR', 'ESCALATED', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED', 'CANCELLED', 'DUPLICATE']) {
        const count = issueCounts.get(`${facility.id}:${status}`) ?? 0;
        issuesRaised += count;
        if (addressedIssueStatuses.includes(status)) issuesAddressed += count;
      }
    }
    return {
      lgaName: lga.name,
      majorHealthFacilityManager: majorManager ? `${majorManager.firstName} ${majorManager.lastName}`.trim() : 'Not assigned',
      totalFacilitiesEquipped: lga.facilities.filter((facility) => facility._count.equipment > 0).length,
      totalConductedTasks: conducted,
      totalNotConducted: notConducted,
      totalIssuesRaised: issuesRaised,
      totalAddressed: issuesAddressed,
      compliancePercent: percentage(conducted, notConducted),
    };
  });

  const summary = rows.reduce((result, row) => ({
    totalLgas: result.totalLgas + 1,
    totalFacilitiesEquipped: result.totalFacilitiesEquipped + row.totalFacilitiesEquipped,
    totalConductedTasks: result.totalConductedTasks + row.totalConductedTasks,
    totalNotConducted: result.totalNotConducted + row.totalNotConducted,
    totalIssuesRaised: result.totalIssuesRaised + row.totalIssuesRaised,
    totalAddressed: result.totalAddressed + row.totalAddressed,
  }), { totalLgas: 0, totalFacilitiesEquipped: 0, totalConductedTasks: 0, totalNotConducted: 0, totalIssuesRaised: 0, totalAddressed: 0 });
  summary.compliancePercent = percentage(summary.totalConductedTasks, summary.totalNotConducted);
  return { stateName, period: { from, to }, rows, summary };
}

export async function getStateExecutiveReport(request, response) {
  response.json({ success: true, data: await buildExecutiveReport(request) });
}

export async function exportStateExecutiveReport(request, response) {
  const report = await buildExecutiveReport(request);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FEPPM';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(`${report.stateName} Executive Report`.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = `FEPPM — ${report.stateName} State Executive Report`;
  sheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0967D2' } };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 30;
  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value = `Reporting period: ${report.period.from.toLocaleDateString('en-NG')} – ${report.period.to.toLocaleDateString('en-NG')}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF475467' } };

  const headers = ['LGA NAMES', 'MAJOR HEALTH FACILITY MANAGER', 'TOTAL FACILITIES EQUIPPED', 'TOTAL CONDUCTED TASKS', 'TOTAL NOT CONDUCTED', 'TOTAL ISSUES RAISED', 'TOTAL ADDRESSED', 'COMPLIANCE PERCENT'];
  sheet.addRow([]);
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087A46' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 34;

  for (const row of report.rows) {
    sheet.addRow([
      row.lgaName,
      row.majorHealthFacilityManager,
      row.totalFacilitiesEquipped,
      row.totalConductedTasks,
      row.totalNotConducted,
      row.totalIssuesRaised,
      row.totalAddressed,
      row.compliancePercent / 100,
    ]);
  }
  const total = sheet.addRow(['STATE TOTAL', '', report.summary.totalFacilitiesEquipped, report.summary.totalConductedTasks, report.summary.totalNotConducted, report.summary.totalIssuesRaised, report.summary.totalAddressed, report.summary.compliancePercent / 100]);
  total.font = { bold: true };
  total.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FF' } };
  sheet.getColumn(8).numFmt = '0.00%';
  sheet.columns = [{ width: 24 }, { width: 34 }, { width: 23 }, { width: 22 }, { width: 22 }, { width: 20 }, { width: 18 }, { width: 20 }];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber >= 5) row.alignment = { vertical: 'middle', wrapText: true };
    row.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDE5EF' } } }; });
  });
  sheet.autoFilter = { from: 'A4', to: 'H4' };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${safeFilename(report.stateName)}-State-Executive-Report-${request.query.from ?? 'current'}-${request.query.to ?? 'period'}.xlsx`;
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.send(Buffer.from(buffer));
}
