import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '../src/lib/prisma.js';
import { ANAMBRA_LGAS } from './anambra/anambraWorkbook.js';

const SOURCE = 'ANAMBRA_CCE_27032026';
const ORGANIZATION_NAME = 'Anambra State Ministry of Health';
const OUTPUT = path.resolve(process.cwd(), 'reports', 'generated', 'anambra-verification.json');
const EXPECTED = { facilities: 763, contacts: 718, equipment: 4513, lgas: 21 };

function descendants(units, rootId) {
  const children = new Map();
  for (const unit of units) {
    if (!children.has(unit.parentId)) children.set(unit.parentId, []);
    children.get(unit.parentId).push(unit.id);
  }
  const ids = new Set([rootId]);
  const queue = [rootId];
  while (queue.length) {
    for (const child of children.get(queue.shift()) ?? []) {
      if (!ids.has(child)) {
        ids.add(child);
        queue.push(child);
      }
    }
  }
  return ids;
}

async function main() {
  const organization = await prisma.organization.findFirst({ where: { name: ORGANIZATION_NAME } });
  if (!organization) throw new Error(`${ORGANIZATION_NAME} was not found.`);
  const [units, facilities, equipment, contacts, schedules, templates] = await Promise.all([
    prisma.administrativeUnit.findMany({
      where: { organizationId: organization.id },
      select: { id: true, parentId: true, name: true, type: true },
    }),
    prisma.facility.findMany({
      where: { organizationId: organization.id, source: SOURCE },
      select: { id: true, administrativeUnitId: true, latitude: true, longitude: true, sourceData: true, sourceFingerprint: true },
    }),
    prisma.equipment.findMany({
      where: { source: SOURCE, facility: { organizationId: organization.id } },
      select: {
        id: true,
        facilityId: true,
        sourceData: true,
        sourceFingerprint: true,
        equipmentType: { select: { category: { select: { name: true } }, name: true } },
      },
    }),
    prisma.facilityContact.count({ where: { source: SOURCE, facility: { organizationId: organization.id } } }),
    prisma.maintenanceSchedule.count({ where: { equipment: { source: SOURCE, facility: { organizationId: organization.id } } } }),
    prisma.checklistTemplate.findMany({
      where: { equipmentType: { equipment: { some: { source: SOURCE, facility: { organizationId: organization.id } } } } },
      select: { status: true, name: true, frequencyType: true, equipmentType: { select: { name: true } } },
    }),
  ]);
  const state = units.find((unit) => unit.type === 'STATE' && unit.name === 'Anambra');
  if (!state) throw new Error('Anambra state administrative unit was not found.');
  const stateScopeIds = descendants(units, state.id);
  const lgas = units.filter((unit) => unit.type === 'LGA' && unit.parentId === state.id);
  const wards = units.filter((unit) => unit.type === 'WARD');
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const categoryCounts = new Map();
  for (const asset of equipment) {
    const category = asset.equipmentType.category.name;
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  const assignedUnitTypes = new Map();
  for (const facility of facilities) {
    const type = unitById.get(facility.administrativeUnitId)?.type ?? 'MISSING';
    assignedUnitTypes.set(type, (assignedUnitTypes.get(type) ?? 0) + 1);
  }
  const activeTemplates = templates.filter((template) => template.status === 'ACTIVE');
  const checks = {
    expectedFacilityCount: facilities.length === EXPECTED.facilities,
    expectedContactCount: contacts === EXPECTED.contacts,
    expectedEquipmentCount: equipment.length === EXPECTED.equipment,
    completeLgaHierarchy: lgas.length === EXPECTED.lgas && ANAMBRA_LGAS.every((name) => lgas.some((lga) => lga.name === name)),
    allFacilitiesInsideStateScope: facilities.every((facility) => stateScopeIds.has(facility.administrativeUnitId)),
    allEquipmentHasFacility: equipment.every((asset) => facilities.some((facility) => facility.id === asset.facilityId)),
    facilityAuditMetadataComplete: facilities.every((facility) => facility.sourceData && facility.sourceFingerprint),
    equipmentAuditMetadataComplete: equipment.every((asset) => asset.sourceData && asset.sourceFingerprint),
    checklistSchedulePolicyHonored: activeTemplates.length > 0 ? schedules > 0 : schedules === 0,
  };
  const report = {
    phase: 6,
    verifiedAt: new Date().toISOString(),
    databaseTarget: 'configured DATABASE_URL',
    organization: organization.name,
    counts: {
      facilities: facilities.length,
      contacts,
      equipment: equipment.length,
      administrativeUnits: units.length,
      lgas: lgas.length,
      wards: wards.length,
      facilitiesWithCoordinates: facilities.filter((facility) => facility.latitude != null && facility.longitude != null).length,
      facilitiesUnderUnspecifiedWard: facilities.filter((facility) => unitById.get(facility.administrativeUnitId)?.name === 'Unspecified Ward').length,
      schedules,
      activeMatchingChecklistTemplates: activeTemplates.length,
    },
    facilitiesByAssignedUnitType: Object.fromEntries([...assignedUnitTypes.entries()].sort()),
    equipmentByCategory: Object.fromEntries([...categoryCounts.entries()].sort()),
    checklistTemplates: templates,
    checks,
    passed: Object.values(checks).every(Boolean),
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath: OUTPUT, ...report }, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
