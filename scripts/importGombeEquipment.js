import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { prisma } from '../src/lib/prisma.js';

const SOURCE = 'GOMBE_CCE_EQUIPMENT_2026';
const ORGANIZATION_NAME = 'Gombe State Ministry of Health';
const DEFAULT_FILE = path.resolve(process.cwd(), '..', '..', 'gombewithequip.csv');

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizedKey = (value) => clean(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const hash = (value, length = 10) => crypto.createHash('sha256').update(value).digest('hex').slice(0, length).toUpperCase();
const meaningful = (value) => !['', 'na', 'n a', 'nil', 'non', 'not applicable', 'not aplicable'].includes(normalizedKey(value));

function args() {
  const values = process.argv.slice(2);
  const file = values.find((value) => value.startsWith('--file='));
  return { apply: values.includes('--apply'), filePath: path.resolve(file ? file.slice(7) : DEFAULT_FILE) };
}

function lgaName(value) {
  const names = { akko: 'Akko', balanga: 'Balanga', billiri: 'Billiri', dukku: 'Dukku', funakaye: 'Funakaye', gombe: 'Gombe', kaltungo: 'Kaltungo', kwami: 'Kwami', nafada: 'Nafada', shomgom: 'Shongom', shongom: 'Shongom', 'yamaltu deba': 'Yamaltu/Deba' };
  return names[normalizedKey(value)] ?? clean(value);
}

function facilityCode(lga, facility) {
  const key = `${normalizedKey(lga)}|${normalizedKey(facility)}`;
  return `GMB-${normalizedKey(lga).replace(/\s+/g, '').slice(0, 4).toUpperCase()}-${hash(key, 8)}`;
}

function yesNo(value) {
  if (/^(yes|y|true|1)$/i.test(clean(value))) return true;
  if (/^(no|n|false|0)$/i.test(clean(value))) return false;
  return null;
}

function number(value) {
  const match = clean(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function year(value) {
  const parsed = Math.trunc(number(value));
  return parsed >= 1950 && parsed <= new Date().getFullYear() ? parsed : null;
}

function manufacturerName(value) {
  const key = normalizedKey(value);
  if (!meaningful(value)) return 'Unknown Manufacturer';
  if (key.includes('biomedical') || key.includes('b medical') || key.includes('bmedical')) return 'B Medical Systems';
  if (key.includes('dometic')) return 'Dometic';
  if (key.includes('aucma')) return 'Aucma';
  if (key.includes('haier')) return 'Haier Thermocool';
  if (key.includes('vestfrost')) return 'Vestfrost';
  return clean(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function modelName(value) {
  if (!meaningful(value)) return 'Unknown Model';
  const compact = clean(value).toUpperCase().replace(/\bSDD\b/g, '').replace(/[^A-Z0-9]/g, '');
  const known = compact.match(/(TCW|TW)(40|2000|2043|3000)/);
  if (known) return `${known[1]} ${known[2]}`;
  if (compact === 'SDDTCW40') return 'TCW 40';
  return clean(value).toUpperCase().replace(/\s+/g, ' ');
}

function equipmentTypeName(category, model) {
  const key = normalizedKey(category);
  if (key === 'ilr') return 'Ice-Lined Refrigerator';
  if (key.includes('sdd') && key.includes('freezer')) return 'Solar Direct Drive Freezer';
  if (key.includes('freezer')) return 'Vaccine Freezer';
  if (key === 'sdd' || /TCW|TW\s?(40|2000|2043|3000)/i.test(model)) return 'Solar Direct Drive Refrigerator';
  return 'Other Cold Chain Equipment';
}

function functionality(value) {
  const parsed = yesNo(value);
  if (parsed === true || /^functional$/i.test(clean(value))) return 'FUNCTIONAL';
  if (parsed === false) return 'NON_FUNCTIONAL';
  return 'UNKNOWN';
}

function sourceRecord(row, index) {
  const lga = lgaName(row[2]);
  const facilityName = clean(row[4]);
  const sourceRowNumber = index + 4;
  const model = modelName(row[33]);
  const typeName = equipmentTypeName(row[31], model);
  const serialNumber = meaningful(row[36]) ? clean(row[36]) : null;
  const suppliedAssetTag = meaningful(row[37]) ? clean(row[37]) : null;
  const identity = serialNumber || suppliedAssetTag || `${lga}|${facilityName}|${sourceRowNumber}|${model}`;
  const assetCode = suppliedAssetTag || `GMB-CCE-${hash(identity, 10)}`;
  const installed = year(row[44]);
  const status = functionality(row[41]);
  return {
    sourceRowNumber, lga, facilityName, facilityCode: facilityCode(lga, facilityName),
    category: clean(row[31]), manufacturer: manufacturerName(row[32]), model, typeName,
    assetCode, serialNumber, suppliedAssetTag,
    grossVolumeLitres: number(row[34]), netVolumeLitres: number(row[35]),
    hasAlarmSystem: yesNo(row[38]), hasAdequateShelves: yesNo(row[39]), hasCurtain: yesNo(row[40]),
    functionalityStatus: status, conditionStatus: status === 'FUNCTIONAL' ? 'GOOD' : status === 'NON_FUNCTIONAL' ? 'POOR' : 'UNKNOWN',
    downtimeMonths: number(row[42]), nonFunctionalReason: meaningful(row[43]) ? clean(row[43]) : null,
    installationDate: installed ? new Date(Date.UTC(installed, 0, 1)) : null,
    powerSource: meaningful(row[45]) ? clean(row[45]) : null,
    coolingUnitCount: number(row[46]),
    hasContinuousTemperatureMonitor: yesNo(row[47]), hasBuiltInThermometer: yesNo(row[48]),
    fundingSource: meaningful(row[49]) ? clean(row[49]) : null,
    repairHistory: meaningful(row[50]) ? clean(row[50]) : null,
    underWarranty: yesNo(row[51]),
  };
}

function readRecords(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`CSV file not found: ${filePath}`);
  const rows = parse(fs.readFileSync(filePath, 'utf8'), { bom: true, relax_column_count: true, skip_empty_lines: false });
  if (clean(rows[1]?.[4]) !== 'Facility Name' || !clean(rows[1]?.[30]).startsWith('Facility Equipped')) throw new Error('Unexpected Gombe equipment CSV structure.');
  return rows.slice(3).map(sourceRecord).filter((record, index) => /^(yes|equipped)$/i.test(clean(rows[index + 3][30])));
}

async function context(records) {
  const organization = await prisma.organization.findFirst({ where: { name: ORGANIZATION_NAME } });
  if (!organization) return { organization: null, facilities: new Map(), existing: new Set(), activeTemplateTypes: new Set() };
  const [facilities, existing, templates] = await Promise.all([
    prisma.facility.findMany({ where: { organizationId: organization.id, facilityCode: { in: [...new Set(records.map((record) => record.facilityCode))] } }, select: { id: true, facilityCode: true, name: true } }),
    prisma.equipment.findMany({ where: { facility: { organizationId: organization.id }, assetCode: { in: records.map((record) => record.assetCode) } }, select: { facilityId: true, assetCode: true } }),
    prisma.checklistTemplate.findMany({ where: { status: 'ACTIVE', frequencyType: { in: ['DAILY', 'WEEKLY', 'MONTHLY'] } }, select: { equipmentTypeId: true } }),
  ]);
  return { organization, facilities: new Map(facilities.map((facility) => [facility.facilityCode, facility])), existing: new Set(existing.map((item) => `${item.facilityId}|${item.assetCode}`)), activeTemplateTypes: new Set(templates.map((item) => item.equipmentTypeId)) };
}

async function apply(records, state) {
  const category = await prisma.equipmentCategory.upsert({ where: { name: 'Cold Chain Equipment' }, update: {}, create: { name: 'Cold Chain Equipment', description: 'Immunization cold-chain storage equipment.' } });
  const facilityManagerRole = await prisma.role.findUnique({ where: { key: 'FACILITY_MANAGER' } });
  let schedulesCreated = 0;
  for (const record of records) {
    const facility = state.facilities.get(record.facilityCode);
    if (!facility) continue;
    const equipmentType = await prisma.equipmentType.upsert({ where: { categoryId_name: { categoryId: category.id, name: record.typeName } }, update: {}, create: { categoryId: category.id, name: record.typeName } });
    const manufacturer = await prisma.manufacturer.upsert({ where: { name: record.manufacturer }, update: {}, create: { name: record.manufacturer } });
    const model = await prisma.equipmentModel.upsert({
      where: { manufacturerId_modelName: { manufacturerId: manufacturer.id, modelName: record.model } },
      update: { equipmentTypeId: equipmentType.id },
      create: { manufacturerId: manufacturer.id, equipmentTypeId: equipmentType.id, modelName: record.model, technicalSpecs: { sourceCategory: record.category } },
    });
    const equipment = await prisma.equipment.upsert({
      where: { facilityId_assetCode: { facilityId: facility.id, assetCode: record.assetCode } },
      update: { equipmentTypeId: equipmentType.id, equipmentModelId: model.id, serialNumber: record.serialNumber, installationDate: record.installationDate, powerSource: record.powerSource, functionalityStatus: record.functionalityStatus, conditionStatus: record.conditionStatus, grossVolumeLitres: record.grossVolumeLitres, netVolumeLitres: record.netVolumeLitres, hasAlarmSystem: record.hasAlarmSystem, hasAdequateShelves: record.hasAdequateShelves, hasCurtain: record.hasCurtain, downtimeMonths: record.downtimeMonths, nonFunctionalReason: record.nonFunctionalReason, coolingUnitCount: record.coolingUnitCount, hasContinuousTemperatureMonitor: record.hasContinuousTemperatureMonitor, hasBuiltInThermometer: record.hasBuiltInThermometer, fundingSource: record.fundingSource, repairHistory: record.repairHistory, underWarranty: record.underWarranty, source: SOURCE, sourceRowNumber: record.sourceRowNumber, status: 'ACTIVE' },
      create: { facilityId: facility.id, equipmentTypeId: equipmentType.id, equipmentModelId: model.id, assetCode: record.assetCode, serialNumber: record.serialNumber, installationDate: record.installationDate, powerSource: record.powerSource, functionalityStatus: record.functionalityStatus, conditionStatus: record.conditionStatus, grossVolumeLitres: record.grossVolumeLitres, netVolumeLitres: record.netVolumeLitres, hasAlarmSystem: record.hasAlarmSystem, hasAdequateShelves: record.hasAdequateShelves, hasCurtain: record.hasCurtain, downtimeMonths: record.downtimeMonths, nonFunctionalReason: record.nonFunctionalReason, coolingUnitCount: record.coolingUnitCount, hasContinuousTemperatureMonitor: record.hasContinuousTemperatureMonitor, hasBuiltInThermometer: record.hasBuiltInThermometer, fundingSource: record.fundingSource, repairHistory: record.repairHistory, underWarranty: record.underWarranty, source: SOURCE, sourceRowNumber: record.sourceRowNumber, status: 'ACTIVE' },
    });
    const templates = await prisma.checklistTemplate.findMany({ where: { equipmentTypeId: equipmentType.id, status: 'ACTIVE', frequencyType: { in: ['DAILY', 'WEEKLY', 'MONTHLY'] } } });
    for (const template of templates) {
      const schedule = await prisma.maintenanceSchedule.findFirst({ where: { equipmentId: equipment.id, checklistTemplateId: template.id } });
      if (!schedule) { await prisma.maintenanceSchedule.create({ data: { equipmentId: equipment.id, checklistTemplateId: template.id, assignedRoleId: facilityManagerRole?.id, frequencyType: template.frequencyType, startDate: new Date(), active: true } }); schedulesCreated += 1; }
    }
  }
  return { equipmentUpserted: records.filter((record) => state.facilities.has(record.facilityCode)).length, schedulesCreated };
}

async function main() {
  const { apply: shouldApply, filePath } = args();
  const records = readRecords(filePath);
  const state = await context(records);
  const matched = records.filter((record) => state.facilities.has(record.facilityCode));
  const unmatched = records.filter((record) => !state.facilities.has(record.facilityCode));
  const duplicateIdentity = records.length - new Set(records.map((record) => `${record.facilityCode}|${record.assetCode}`)).size;
  const report = {
    mode: shouldApply ? 'apply' : 'preview', filePath, sourceEquipmentRows: records.length,
    facilitiesWithEquipment: new Set(records.map((record) => record.facilityCode)).size,
    matchedEquipmentRows: matched.length, unmatchedEquipmentRows: unmatched.length,
    equipmentToCreate: matched.filter((record) => !state.existing.has(`${state.facilities.get(record.facilityCode).id}|${record.assetCode}`)).length,
    equipmentToUpdate: matched.filter((record) => state.existing.has(`${state.facilities.get(record.facilityCode).id}|${record.assetCode}`)).length,
    duplicateEquipmentIdentity: duplicateIdentity,
    byType: Object.fromEntries([...records.reduce((map, record) => map.set(record.typeName, (map.get(record.typeName) ?? 0) + 1), new Map())]),
    byStatus: Object.fromEntries([...records.reduce((map, record) => map.set(record.functionalityStatus, (map.get(record.functionalityStatus) ?? 0) + 1), new Map())]),
    dataQuality: { missingSerialNumbers: records.filter((record) => !record.serialNumber).length, missingAssetTags: records.filter((record) => !record.suppliedAssetTag).length, missingManufacturers: records.filter((record) => record.manufacturer === 'Unknown Manufacturer').length, missingInstallationYears: records.filter((record) => !record.installationDate).length },
    unmatched: unmatched.map((record) => ({ row: record.sourceRowNumber, lga: record.lga, facility: record.facilityName, expectedFacilityCode: record.facilityCode })),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!shouldApply) { console.log('\nPreview only. Apply the migration, review this report, then rerun with --apply.'); return; }
  if (!state.organization) throw new Error('Gombe organization not found. Import facilities first.');
  const result = await apply(records, state);
  console.log('\nEquipment import completed.');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
