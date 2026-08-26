import path from 'node:path';

import { prisma } from '../src/lib/prisma.js';
import { ANAMBRA_LGAS, hash, normalizedKey, parseWorkbookFile, titleCase } from './anambra/anambraWorkbook.js';
import {
  buildReconciliationReport,
  equipmentTypeFor,
  facilityTypeFor,
  functionalityFor,
  manufacturerFor,
  modelFor,
  numericValue,
  ownershipTypeFor,
  reconcileWorkbook,
  validYear,
  yesNo,
} from './anambra/anambraReconciliation.js';

const SOURCE = 'ANAMBRA_CCE_27032026';
const EXPECTED_SOURCE_HASH = '9a13e36be6bb1e48f5a728ab89423542055b8dc9412ad17bdff872ee9306a2cb';
const ORGANIZATION_NAME = 'Anambra State Ministry of Health';
const DEFAULT_FILE = path.resolve(
  process.cwd(), '..', '..', 'new dbs',
  "Anambra State & LGAs & Health Facilities' CCE Data_Updated_27032026 (1).xlsx",
);

const CATEGORY_NAMES = {
  coldChain: 'Cold Chain Equipment',
  passiveColdChain: 'Passive Cold Chain Equipment',
  temperatureMonitoring: 'Temperature Monitoring Devices',
  powerHvac: 'Electrical and Power Equipment',
  ict: 'ICT Equipment',
  transport: 'Transport Equipment',
  wasteManagement: 'Waste Management Equipment',
  toolsSafety: 'Maintenance Tools and Safety Equipment',
};

async function mapLimit(values, concurrency, worker) {
  let cursor = 0;
  const results = Array(values.length);
  const runners = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function cached(cache, key, factory) {
  if (!cache.has(key)) cache.set(key, Promise.resolve().then(factory));
  return cache.get(key);
}

function retryableDatabaseError(error) {
  return ['P1001', 'P1008', 'P1017', 'P2024'].includes(error?.code)
    || /can't reach database|connection.*closed|timed out/i.test(error?.message ?? '');
}

async function databaseRetry(operation, label, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!retryableDatabaseError(error) || attempt === attempts) throw error;
      const delay = Math.min(1000 * (2 ** (attempt - 1)), 10_000);
      console.warn(`${label} hit ${error.code ?? 'a connection error'}; retrying in ${delay / 1000}s (${attempt}/${attempts}).`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function parseArguments() {
  const args = process.argv.slice(2);
  const fileArgument = args.find((argument) => argument.startsWith('--file='));
  return {
    apply: args.includes('--apply'),
    summaryOnly: args.includes('--summary-only'),
    allowSourceChange: args.includes('--allow-source-change'),
    filePath: path.resolve(fileArgument ? fileArgument.slice('--file='.length) : DEFAULT_FILE),
  };
}

async function findOrCreateUnit({ organizationId, countryId, parentId, name, code, type }) {
  const existing = await databaseRetry(() => prisma.administrativeUnit.findFirst({
    where: { organizationId, parentId, name, type },
  }), `Find administrative unit ${type}:${name}`);
  const data = { organizationId, countryId, parentId, name, code, type, status: 'ACTIVE', timezone: 'Africa/Lagos' };
  return existing
    ? databaseRetry(() => prisma.administrativeUnit.update({ where: { id: existing.id }, data }), `Update administrative unit ${type}:${name}`)
    : databaseRetry(() => prisma.administrativeUnit.create({ data }), `Create administrative unit ${type}:${name}`);
}

function coldChainType(asset) {
  const category = normalizedKey(asset.category);
  const model = normalizedKey(asset.model);
  if (category === 'ilr') return 'Ice-Lined Refrigerator';
  if (category.includes('wifr')) return 'Walk-In Freezer Room';
  if (category.includes('wicr')) return 'Walk-In Cold Room';
  if (category.includes('sdd') && (category.includes('freezer') || model.includes('freezer'))) return 'Solar Direct Drive Freezer';
  if (category === 'sdd' || model.includes('sdd')) return 'Solar Direct Drive Refrigerator';
  if (category.includes('freezer')) return 'Vaccine Freezer';
  return 'Other Cold Chain Equipment';
}

function mappedEquipmentType(asset) {
  return asset.block === 'coldChain' ? coldChainType(asset) : equipmentTypeFor(asset);
}

function conditionFor(functionality) {
  if (functionality === 'FUNCTIONAL') return 'GOOD';
  if (functionality === 'PARTIALLY_FUNCTIONAL' || functionality === 'UNDER_REPAIR') return 'FAIR';
  if (functionality === 'NON_FUNCTIONAL') return 'POOR';
  if (functionality === 'DECOMMISSIONED') return 'CRITICAL';
  return 'UNKNOWN';
}

function valueAt(asset, index) {
  return asset.values[index] || null;
}

function equipmentFields(asset) {
  const configuration = {
    coldChain: { serial: 5, functioning: 10, downtime: 11, reason: 12, year: 13, power: 14, funding: 18 },
    passiveColdChain: { serial: 5, functioning: 3 },
    temperatureMonitoring: { serial: 3, functioning: 4 },
    powerHvac: { serial: 11, functioning: 3, downtime: 4, reason: 5, year: 6, power: 7, funding: 10 },
    ict: { serial: 8, functioning: 3, downtime: 4, reason: 5, year: 6, funding: 7 },
    transport: { serial: 8, functioning: 3, downtime: 4, reason: 5, year: 6, funding: 7 },
    wasteManagement: { serial: 11, functioning: 5, downtime: 6, reason: 7, year: 8, power: 9, funding: 10 },
    toolsSafety: { serial: null, functioning: 1, downtime: 2, reason: 3, year: 4, funding: 5 },
  }[asset.block];
  const functionalityStatus = functionalityFor(valueAt(asset, configuration.functioning));
  const year = validYear(valueAt(asset, configuration.year));
  const base = {
    serialNumber: configuration.serial == null ? null : valueAt(asset, configuration.serial),
    installationDate: year ? new Date(Date.UTC(year, 0, 1)) : null,
    powerSource: valueAt(asset, configuration.power),
    functionalityStatus,
    conditionStatus: conditionFor(functionalityStatus),
    downtimeMonths: Math.trunc(numericValue(valueAt(asset, configuration.downtime))) || null,
    nonFunctionalReason: valueAt(asset, configuration.reason),
    fundingSource: valueAt(asset, configuration.funding),
  };
  if (asset.block === 'coldChain') {
    Object.assign(base, {
      grossVolumeLitres: numericValue(valueAt(asset, 3)),
      netVolumeLitres: numericValue(valueAt(asset, 4)),
      hasAlarmSystem: yesNo(valueAt(asset, 7)),
      hasAdequateShelves: yesNo(valueAt(asset, 8)),
      hasCurtain: yesNo(valueAt(asset, 9)),
      coolingUnitCount: Math.trunc(numericValue(valueAt(asset, 15))) || null,
      hasContinuousTemperatureMonitor: yesNo(valueAt(asset, 16)),
      hasBuiltInThermometer: yesNo(valueAt(asset, 17)),
      repairHistory: valueAt(asset, 20),
      underWarranty: yesNo(valueAt(asset, 21)),
    });
  }
  if (asset.block === 'passiveColdChain') base.netVolumeLitres = numericValue(valueAt(asset, 4));
  return base;
}

async function databasePreview(reconciled) {
  const organization = await databaseRetry(() => prisma.organization.findFirst({ where: { name: ORGANIZATION_NAME } }), 'Preview organization');
  if (!organization) {
    return {
      organizationExists: false,
      facilitiesToCreate: reconciled.facilities.length,
      facilitiesToUpdate: 0,
      equipmentToCreate: reconciled.assets.length,
      equipmentToUpdate: 0,
    };
  }
  const [existingFacilities, existingEquipment] = await Promise.all([
    databaseRetry(() => prisma.facility.findMany({
      where: { organizationId: organization.id, facilityCode: { in: reconciled.facilities.map((facility) => facility.facilityCode) } },
      select: { facilityCode: true },
    }), 'Preview facilities'),
    databaseRetry(() => prisma.equipment.findMany({
      where: { facility: { organizationId: organization.id }, assetCode: { in: reconciled.assets.map((asset) => asset.assetCode) } },
      select: { assetCode: true },
    }), 'Preview equipment'),
  ]);
  const facilityCodes = new Set(existingFacilities.map((facility) => facility.facilityCode));
  const assetCodes = new Set(existingEquipment.map((equipment) => equipment.assetCode));
  return {
    organizationExists: true,
    facilitiesToCreate: reconciled.facilities.filter((facility) => !facilityCodes.has(facility.facilityCode)).length,
    facilitiesToUpdate: reconciled.facilities.filter((facility) => facilityCodes.has(facility.facilityCode)).length,
    equipmentToCreate: reconciled.assets.filter((asset) => !assetCodes.has(asset.assetCode)).length,
    equipmentToUpdate: reconciled.assets.filter((asset) => assetCodes.has(asset.assetCode)).length,
  };
}

async function applyImport(reconciled) {
  const country = await databaseRetry(() => prisma.country.upsert({
    where: { isoCode: 'NG' },
    update: { name: 'Nigeria', timezone: 'Africa/Lagos', currencyCode: 'NGN' },
    create: { name: 'Nigeria', isoCode: 'NG', timezone: 'Africa/Lagos', currencyCode: 'NGN' },
  }), 'Upsert Nigeria');
  const organization = await databaseRetry(() => prisma.organization.upsert({
    where: { countryId_name: { countryId: country.id, name: ORGANIZATION_NAME } },
    update: { code: 'ANAMBRA-SMOH', type: 'GOVERNMENT', status: 'ACTIVE' },
    create: { countryId: country.id, name: ORGANIZATION_NAME, code: 'ANAMBRA-SMOH', type: 'GOVERNMENT', status: 'ACTIVE' },
  }), 'Upsert Anambra organization');
  const national = await findOrCreateUnit({ organizationId: organization.id, countryId: country.id, parentId: null, name: 'Nigeria', code: 'NG', type: 'NATIONAL' });
  const zone = await findOrCreateUnit({ organizationId: organization.id, countryId: country.id, parentId: national.id, name: 'South East Zone', code: 'NG-SE', type: 'ZONE' });
  const state = await findOrCreateUnit({ organizationId: organization.id, countryId: country.id, parentId: zone.id, name: 'Anambra', code: 'ANAMBRA', type: 'STATE' });
  const lgas = new Map();
  for (const name of ANAMBRA_LGAS) {
    lgas.set(name, await findOrCreateUnit({
      organizationId: organization.id,
      countryId: country.id,
      parentId: state.id,
      name,
      code: `AN-${normalizedKey(name).replace(/\s+/g, '-').toUpperCase()}`,
      type: 'LGA',
    }));
  }

  const wards = new Map();
  const wardDefinitions = new Map();
  for (const source of reconciled.facilities.filter((facility) => facility.scopeLevel === 'WARD')) {
    const wardName = source.ward || 'Unspecified Ward';
    wardDefinitions.set(`${source.lga}|${wardName}`, { lgaName: source.lga, wardName });
  }
  await mapLimit([...wardDefinitions.entries()], 8, async ([wardKey, definition]) => {
    const lga = lgas.get(definition.lgaName);
    wards.set(wardKey, await findOrCreateUnit({
      organizationId: organization.id,
      countryId: country.id,
      parentId: lga.id,
      name: definition.wardName,
      code: `AN-WARD-${hash(wardKey, 12)}`,
      type: 'WARD',
    }));
  });

  const facilitiesByKey = new Map();
  let contactsUpserted = 0;
  let facilitiesCompleted = 0;
  await mapLimit(reconciled.facilities, 8, async (source) => {
    const lga = lgas.get(source.lga);
    if (!lga) throw new Error(`Unrecognized Anambra LGA after reconciliation: ${source.lga}`);
    let administrativeUnit = state;
    if (source.scopeLevel === 'LGA') administrativeUnit = lga;
    if (source.scopeLevel === 'WARD') {
      const wardName = source.ward || 'Unspecified Ward';
      const wardKey = `${source.lga}|${wardName}`;
      administrativeUnit = wards.get(wardKey);
    }
    const coordinates = source.coordinates.valid
      ? { latitude: source.coordinates.latitude, longitude: source.coordinates.longitude }
      : { latitude: null, longitude: null };
    const facilityData = {
      countryId: country.id,
      administrativeUnitId: administrativeUnit.id,
      name: source.facilityName,
      facilityType: facilityTypeFor(source),
      ownershipType: ownershipTypeFor(source),
      address: source.address,
      ...coordinates,
      contactPhone: source.contacts.find((contact) => contact.isPhoneValid)?.normalizedPhone ?? null,
      source: SOURCE,
      sourceFingerprint: hash(source.key, 64),
      sourceData: { sourceLocations: source.sourceLocations, details: source.details, coordinateClassification: source.coordinates.classification },
      timezone: 'Africa/Lagos',
      status: normalizedKey(source.details?.functioning) === 'no' ? 'INACTIVE' : 'ACTIVE',
    };
    const facility = await databaseRetry(() => prisma.facility.upsert({
      where: { organizationId_facilityCode: { organizationId: organization.id, facilityCode: source.facilityCode } },
      update: facilityData,
      create: { organizationId: organization.id, facilityCode: source.facilityCode, ...facilityData },
    }), `Upsert facility ${source.facilityCode}`);
    facilitiesByKey.set(source.key, facility);
    await Promise.all(source.contacts.map(async (contact, contactIndex) => {
      await databaseRetry(() => prisma.facilityContact.upsert({
        where: { facilityId_contactKey: { facilityId: facility.id, contactKey: contact.key } },
        update: {
          fullName: contact.fullName,
          jobTitle: contact.role,
          phone: contact.phone,
          normalizedPhone: contact.normalizedPhone,
          isPhoneValid: contact.isPhoneValid,
          isPrimary: contactIndex === 0,
          source: SOURCE,
          sourceRowNumber: contact.sourceRowNumber,
        },
        create: {
          facilityId: facility.id,
          contactKey: contact.key,
          fullName: contact.fullName,
          jobTitle: contact.role,
          phone: contact.phone,
          normalizedPhone: contact.normalizedPhone,
          isPhoneValid: contact.isPhoneValid,
          isPrimary: contactIndex === 0,
          source: SOURCE,
          sourceRowNumber: contact.sourceRowNumber,
        },
      }), `Upsert contact for ${source.facilityCode}`);
      contactsUpserted += 1;
    }));
    facilitiesCompleted += 1;
    if (facilitiesCompleted % 100 === 0) console.log(`Facilities: ${facilitiesCompleted}/${reconciled.facilities.length}`);
  });

  const categoryCache = new Map();
  const typeCache = new Map();
  const manufacturerCache = new Map();
  const modelCache = new Map();
  const scheduleCandidates = [];
  let equipmentCompleted = 0;
  await mapLimit(reconciled.assets, 8, async (source) => {
    const facility = facilitiesByKey.get(source.facilityKey);
    if (!facility) throw new Error(`Resolved facility was not imported for asset ${source.assetCode}.`);
    const categoryName = CATEGORY_NAMES[source.block];
    const category = await cached(categoryCache, categoryName, () => databaseRetry(() => prisma.equipmentCategory.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName, description: `Imported ${categoryName.toLowerCase()} from the Anambra CCE assessment.` },
      }), `Upsert equipment category ${categoryName}`));
    const typeName = mappedEquipmentType(source);
    const typeKey = `${category.id}|${typeName}`;
    const equipmentType = await cached(typeCache, typeKey, () => databaseRetry(() => prisma.equipmentType.upsert({
        where: { categoryId_name: { categoryId: category.id, name: typeName } },
        update: {},
        create: { categoryId: category.id, name: typeName },
      }), `Upsert equipment type ${typeName}`));
    const manufacturerName = manufacturerFor(source);
    const manufacturer = await cached(manufacturerCache, manufacturerName, () => databaseRetry(
      () => prisma.manufacturer.upsert({ where: { name: manufacturerName }, update: {}, create: { name: manufacturerName } }),
      `Upsert manufacturer ${manufacturerName}`,
    ));
    const modelName = modelFor(source);
    const modelKey = `${manufacturer.id}|${modelName}`;
    const model = await cached(modelCache, modelKey, () => databaseRetry(() => prisma.equipmentModel.upsert({
        where: { manufacturerId_modelName: { manufacturerId: manufacturer.id, modelName } },
        update: { equipmentTypeId: equipmentType.id },
        create: { manufacturerId: manufacturer.id, equipmentTypeId: equipmentType.id, modelName, technicalSpecs: { sourceBlock: source.block } },
      }), `Upsert equipment model ${modelName}`));
    const mappedFields = equipmentFields(source);
    const equipmentData = {
      equipmentTypeId: equipmentType.id,
      equipmentModelId: model.id,
      ...mappedFields,
      source: SOURCE,
      sourceRowNumber: Math.min(...source.sourceLocations.map((location) => location.rowNumber)),
      sourceFingerprint: hash(`${source.facilityKey}|${source.assetCode}`, 64),
      sourceData: { block: source.block, identifiers: source.identifiers, sourceLocations: source.sourceLocations, values: source.values },
      status: 'ACTIVE',
    };
    const equipment = await databaseRetry(() => prisma.equipment.upsert({
      where: { facilityId_assetCode: { facilityId: facility.id, assetCode: source.assetCode } },
      update: equipmentData,
      create: { facilityId: facility.id, assetCode: source.assetCode, ...equipmentData },
    }), `Upsert equipment ${source.assetCode}`);
    if (typeName === 'Solar Direct Drive Refrigerator') scheduleCandidates.push({ equipmentId: equipment.id, equipmentTypeId: equipmentType.id });
    equipmentCompleted += 1;
    if (equipmentCompleted % 250 === 0) console.log(`Equipment: ${equipmentCompleted}/${reconciled.assets.length}`);
  });

  const facilityManagerRole = await prisma.role.findUnique({ where: { key: 'FACILITY_MANAGER' } });
  let schedulesCreated = 0;
  if (facilityManagerRole && scheduleCandidates.length) {
    const equipmentIds = scheduleCandidates.map((candidate) => candidate.equipmentId);
    const typeIds = [...new Set(scheduleCandidates.map((candidate) => candidate.equipmentTypeId))];
    const [templates, existingSchedules] = await Promise.all([
      prisma.checklistTemplate.findMany({ where: { equipmentTypeId: { in: typeIds }, status: 'ACTIVE', frequencyType: { in: ['DAILY', 'WEEKLY', 'MONTHLY'] } } }),
      prisma.maintenanceSchedule.findMany({ where: { equipmentId: { in: equipmentIds } }, select: { equipmentId: true, checklistTemplateId: true } }),
    ]);
    const existingKeys = new Set(existingSchedules.map((schedule) => `${schedule.equipmentId}|${schedule.checklistTemplateId}`));
    const typeByEquipment = new Map(scheduleCandidates.map((candidate) => [candidate.equipmentId, candidate.equipmentTypeId]));
    const pendingSchedules = [];
    for (const equipmentId of equipmentIds) {
      for (const template of templates.filter((item) => item.equipmentTypeId === typeByEquipment.get(equipmentId))) {
        if (!existingKeys.has(`${equipmentId}|${template.id}`)) {
          pendingSchedules.push({ equipmentId, checklistTemplateId: template.id, assignedRoleId: facilityManagerRole.id, frequencyType: template.frequencyType, startDate: new Date(), active: true });
        }
      }
    }
    if (pendingSchedules.length) {
      const result = await prisma.maintenanceSchedule.createMany({ data: pendingSchedules });
      schedulesCreated = result.count;
    }
  }

  return {
    organization: organization.name,
    administrativeUnits: { national: 1, zones: 1, states: 1, lgas: lgas.size, wards: wards.size },
    facilitiesUpserted: reconciled.facilities.length,
    contactsUpserted,
    equipmentUpserted: reconciled.assets.length,
    schedulesCreated,
  };
}

async function main() {
  const options = parseArguments();
  const { sheets, report: sourceReport } = await parseWorkbookFile(options.filePath);
  if (sourceReport.source.sha256 !== EXPECTED_SOURCE_HASH && !options.allowSourceChange) {
    throw new Error(`Source workbook hash changed. Expected ${EXPECTED_SOURCE_HASH}, received ${sourceReport.source.sha256}. Review the new source and pass --allow-source-change only after approval.`);
  }
  const reconciled = reconcileWorkbook(sheets);
  const [fullReconciliation, database] = await Promise.all([
    Promise.resolve(buildReconciliationReport(reconciled)),
    databasePreview(reconciled),
  ]);
  const reconciliation = options.summaryOnly
    ? Object.fromEntries(Object.entries(fullReconciliation).filter(([key]) => key !== 'issueSamples'))
    : fullReconciliation;
  console.log(JSON.stringify({ mode: options.apply ? 'apply' : 'database-preview', source: sourceReport.source, reconciliation, database }, null, 2));
  if (!options.apply) {
    console.log('\nDatabase preview only. Re-run with --apply to write the reconciled records.');
    return;
  }
  const result = await applyImport(reconciled);
  console.log('\nAnambra import completed.');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
