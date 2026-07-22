import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'csv-parse/sync';

import { prisma } from '../src/lib/prisma.js';

const SOURCE_NAME = 'GOMBE_CCE_03022026';
const DEFAULT_FILE = path.resolve(process.cwd(), '..', '..', 'GOMBE .csv');
const ORGANIZATION_NAME = 'Gombe State Ministry of Health';

const lgaNames = new Map([
  ['akko', 'Akko'],
  ['balanga', 'Balanga'],
  ['billiri', 'Billiri'],
  ['dukku', 'Dukku'],
  ['funakaye', 'Funakaye'],
  ['gombe', 'Gombe'],
  ['kaltungo', 'Kaltungo'],
  ['kwami', 'Kwami'],
  ['nafada', 'Nafada'],
  ['shomgom', 'Shongom'],
  ['shongom', 'Shongom'],
  ['yamaltu deba', 'Yamaltu/Deba'],
]);

const acronyms = new Set(['BHCPF', 'BHPHC', 'CCE', 'GH', 'HC', 'HP', 'MCH', 'PHC', 'PHCC']);

function parseArguments() {
  const args = process.argv.slice(2);
  const fileArgument = args.find((argument) => argument.startsWith('--file='));
  return {
    apply: args.includes('--apply'),
    filePath: path.resolve(fileArgument ? fileArgument.slice('--file='.length) : DEFAULT_FILE),
  };
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizedKey(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hash(value, length = 10) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, length).toUpperCase();
}

function titleCase(value) {
  return clean(value)
    .toLowerCase()
    .split(' ')
    .map((word) => {
      const upper = word.toUpperCase();
      if (acronyms.has(upper)) return upper;
      return word ? word[0].toUpperCase() + word.slice(1) : word;
    })
    .join(' ');
}

function canonicalLga(value) {
  const key = normalizedKey(value);
  return lgaNames.get(key) ?? titleCase(value);
}

function parseCoordinate(value) {
  const source = clean(value);
  if (!source) return { value: null, format: 'missing' };

  const decimal = Number(source);
  if (Number.isFinite(decimal)) return { value: decimal, format: 'decimal' };

  const dms = source.match(/^(\d{1,3})[.°](\d{1,2})['’](\d{1,2}(?:\.\d+)?)"?$/);
  if (!dms) return { value: null, format: 'invalid' };
  return {
    value: Number(dms[1]) + Number(dms[2]) / 60 + Number(dms[3]) / 3600,
    format: 'dms',
  };
}

function parseCoordinatePair(longitudeSource, latitudeSource) {
  const longitude = parseCoordinate(longitudeSource);
  const latitude = parseCoordinate(latitudeSource);
  const inNigeria = longitude.value >= 2 && longitude.value <= 15
    && latitude.value >= 4 && latitude.value <= 14;

  return {
    longitude: inNigeria ? longitude.value : null,
    latitude: inNigeria ? latitude.value : null,
    valid: Boolean(inNigeria),
    convertedFromDms: inNigeria && (longitude.format === 'dms' || latitude.format === 'dms'),
    sourceLongitude: clean(longitudeSource),
    sourceLatitude: clean(latitudeSource),
  };
}

function normalizePhone(value) {
  const raw = clean(value);
  let normalized = raw.replace(/\D/g, '');
  if (normalized.startsWith('234') && normalized.length === 13) normalized = `0${normalized.slice(3)}`;
  if (normalized.length === 10 && /^[789]/.test(normalized)) normalized = `0${normalized}`;
  const valid = /^0[789]\d{9}$/.test(normalized);
  return { raw: raw || null, normalized: normalized || null, valid };
}

function facilityType(row) {
  const sourceType = normalizedKey(row[5]);
  const classification = normalizedKey(row[7]);

  if (sourceType.includes('vaccine cold store')) return 'WAREHOUSE';
  if (classification === 'hp') return 'HEALTH_POST';
  if (sourceType.includes('tertiary') || classification.includes('teaching')) return 'TEACHING_HOSPITAL';
  if (
    sourceType.includes('secondary')
    || sourceType.includes('secondry')
    || sourceType.includes('cottage hospital')
    || classification === 'gh'
    || classification.includes('general')
    || classification.includes('cottage')
  ) return 'GENERAL_HOSPITAL';
  if (sourceType.includes('primary') || sourceType.includes('prumary')) return 'PRIMARY_HEALTH_CENTRE';
  return 'OTHER';
}

function ownershipType(value) {
  const ownership = normalizedKey(value);
  if (ownership === 'private') return 'PRIVATE';
  if (['public', 'pyblic'].includes(ownership)) return 'PUBLIC';
  return null;
}

function recordStatus(value) {
  const status = normalizedKey(value);
  return status === 'no' ? 'INACTIVE' : 'ACTIVE';
}

function rowScore(record) {
  return (record.coordinates.valid ? 5 : 0)
    + (record.contact.phone.valid ? 3 : 0)
    + (record.state ? 1 : 0)
    + (['yes', 'no'].includes(normalizedKey(record.functioning)) ? 1 : 0)
    + (record.ownership ? 1 : 0);
}

function sourceRecord(row, rowNumber) {
  const lga = canonicalLga(row[2]);
  const facilityName = titleCase(row[4]);
  const phone = normalizePhone(row[29]);
  const officerName = titleCase(row[28]);

  return {
    rowNumber,
    serialNumber: clean(row[0]),
    state: clean(row[1]) || 'Gombe',
    lga,
    ward: titleCase(row[3]),
    facilityName,
    address: clean(row[8]),
    sourceType: clean(row[5]),
    sourceClassification: clean(row[7]),
    facilityType: facilityType(row),
    ownership: ownershipType(row[17]),
    functioning: clean(row[15]),
    status: recordStatus(row[15]),
    coordinates: parseCoordinatePair(row[11], row[12]),
    contact: {
      fullName: officerName,
      phone,
      sourceRowNumber: rowNumber,
    },
    raw: row,
  };
}

function contactKey(contact) {
  const identity = contact.phone.valid
    ? `phone:${contact.phone.normalized}`
    : `name:${normalizedKey(contact.fullName)}|phone:${contact.phone.normalized ?? ''}`;
  return hash(identity, 32);
}

function parseSource(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`CSV file not found: ${filePath}`);
  const rows = parse(fs.readFileSync(filePath, 'utf8'), {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  });

  if (clean(rows[1]?.[1]) !== 'State' || clean(rows[1]?.[4]) !== 'Facility Name') {
    throw new Error('The CSV does not match the expected Gombe CCE three-row header structure.');
  }

  const sourceRecords = rows
    .slice(3)
    .map((row, index) => sourceRecord(row, index + 4))
    .filter((record) => record.serialNumber || record.facilityName);

  const groups = new Map();
  for (const record of sourceRecords) {
    const key = `${normalizedKey(record.lga)}|${normalizedKey(record.facilityName)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  const facilities = [...groups.entries()].map(([deduplicationKey, records]) => {
    const ranked = records
      .map((record, index) => ({ record, index, score: rowScore(record) }))
      .sort((left, right) => right.score - left.score || left.index - right.index);
    const selected = ranked[0].record;
    const contacts = new Map();

    for (const record of records) {
      if (!record.contact.fullName) continue;
      const key = contactKey(record.contact);
      if (!contacts.has(key)) contacts.set(key, { ...record.contact, contactKey: key });
    }

    const selectedContactKey = selected.contact.fullName ? contactKey(selected.contact) : null;
    return {
      ...selected,
      deduplicationKey,
      sourceRows: records.map((record) => record.rowNumber),
      contacts: [...contacts.values()].map((contact) => ({
        ...contact,
        isPrimary: contact.contactKey === selectedContactKey,
      })),
      facilityCode: `GMB-${normalizedKey(selected.lga).replace(/\s+/g, '').slice(0, 4).toUpperCase()}-${hash(deduplicationKey, 8)}`,
    };
  });

  return { sourceRecords, facilities };
}

function buildReport(sourceRecords, facilities) {
  const lgas = new Set(facilities.map((record) => record.lga));
  const wards = new Set(facilities.map((record) => `${record.lga}|${record.ward}`));
  const duplicateGroups = facilities.filter((record) => record.sourceRows.length > 1);
  const invalidCoordinates = sourceRecords.filter((record) => !record.coordinates.valid);
  const dmsCoordinates = sourceRecords.filter((record) => record.coordinates.convertedFromDms);
  const invalidPhones = sourceRecords.filter((record) => record.contact.phone.raw && !record.contact.phone.valid);
  const missingOfficerPhones = sourceRecords.filter((record) => record.contact.fullName && !record.contact.phone.raw);
  const contacts = facilities.reduce((total, facility) => total + facility.contacts.length, 0);

  return {
    sourceRows: sourceRecords.length,
    uniqueFacilities: facilities.length,
    duplicateGroups: duplicateGroups.length,
    duplicateRowsCollapsed: sourceRecords.length - facilities.length,
    lgas: lgas.size,
    wards: wards.size,
    facilityContacts: contacts,
    validCoordinatePairs: facilities.filter((record) => record.coordinates.valid).length,
    facilitiesWithoutValidCoordinates: facilities.filter((record) => !record.coordinates.valid).length,
    sourceRowsWithInvalidCoordinates: invalidCoordinates.map((record) => ({
      row: record.rowNumber,
      facility: record.facilityName,
      longitude: record.coordinates.sourceLongitude,
      latitude: record.coordinates.sourceLatitude,
    })),
    sourceRowsConvertedFromDms: dmsCoordinates.map((record) => record.rowNumber),
    malformedOfficerPhones: invalidPhones.map((record) => ({ row: record.rowNumber, facility: record.facilityName })),
    officersWithoutPhones: missingOfficerPhones.map((record) => ({ row: record.rowNumber, facility: record.facilityName })),
    duplicateFacilities: duplicateGroups.map((record) => ({
      lga: record.lga,
      facility: record.facilityName,
      sourceRows: record.sourceRows,
    })),
  };
}

async function findOrCreateAdministrativeUnit({ organizationId, countryId, parentId, name, code, type }) {
  const existing = await prisma.administrativeUnit.findFirst({
    where: { organizationId, parentId, name, type },
  });
  if (existing) {
    return prisma.administrativeUnit.update({
      where: { id: existing.id },
      data: { countryId, code, status: 'ACTIVE', timezone: 'Africa/Lagos' },
    });
  }
  return prisma.administrativeUnit.create({
    data: {
      organizationId,
      countryId,
      parentId,
      name,
      code,
      type,
      status: 'ACTIVE',
      timezone: 'Africa/Lagos',
    },
  });
}

async function databasePreview(facilities) {
  const organization = await prisma.organization.findFirst({ where: { name: ORGANIZATION_NAME } });
  if (!organization) return { organizationExists: false, facilitiesToCreate: facilities.length, facilitiesToUpdate: 0 };
  const existing = await prisma.facility.findMany({
    where: { organizationId: organization.id, facilityCode: { in: facilities.map((record) => record.facilityCode) } },
    select: { facilityCode: true },
  });
  return {
    organizationExists: true,
    facilitiesToCreate: facilities.length - existing.length,
    facilitiesToUpdate: existing.length,
  };
}

async function applyImport(facilities) {
  const country = await prisma.country.upsert({
    where: { isoCode: 'NG' },
    update: { name: 'Nigeria', timezone: 'Africa/Lagos', currencyCode: 'NGN' },
    create: { name: 'Nigeria', isoCode: 'NG', timezone: 'Africa/Lagos', currencyCode: 'NGN' },
  });
  const organization = await prisma.organization.upsert({
    where: { countryId_name: { countryId: country.id, name: ORGANIZATION_NAME } },
    update: { code: 'GOMBE-SMOH', type: 'GOVERNMENT', status: 'ACTIVE' },
    create: {
      countryId: country.id,
      name: ORGANIZATION_NAME,
      code: 'GOMBE-SMOH',
      type: 'GOVERNMENT',
      status: 'ACTIVE',
    },
  });

  const national = await findOrCreateAdministrativeUnit({
    organizationId: organization.id,
    countryId: country.id,
    parentId: null,
    name: 'Nigeria',
    code: 'NG',
    type: 'NATIONAL',
  });
  const zone = await findOrCreateAdministrativeUnit({
    organizationId: organization.id,
    countryId: country.id,
    parentId: national.id,
    name: 'North East Zone',
    code: 'NG-NE',
    type: 'ZONE',
  });
  const state = await findOrCreateAdministrativeUnit({
    organizationId: organization.id,
    countryId: country.id,
    parentId: zone.id,
    name: 'Gombe',
    code: 'GOMBE',
    type: 'STATE',
  });

  const lgaCache = new Map();
  const wardCache = new Map();
  let contactsUpserted = 0;

  for (const record of facilities) {
    if (!lgaCache.has(record.lga)) {
      lgaCache.set(record.lga, await findOrCreateAdministrativeUnit({
        organizationId: organization.id,
        countryId: country.id,
        parentId: state.id,
        name: record.lga,
        code: `GOM-${normalizedKey(record.lga).replace(/\s+/g, '-').toUpperCase()}`,
        type: 'LGA',
      }));
    }
    const lga = lgaCache.get(record.lga);
    const wardKey = `${record.lga}|${record.ward}`;
    if (!wardCache.has(wardKey)) {
      wardCache.set(wardKey, await findOrCreateAdministrativeUnit({
        organizationId: organization.id,
        countryId: country.id,
        parentId: lga.id,
        name: record.ward,
        code: `GOM-WARD-${hash(wardKey, 10)}`,
        type: 'WARD',
      }));
    }
    const ward = wardCache.get(wardKey);
    const validPhone = record.contact.phone.valid ? record.contact.phone.normalized : undefined;
    const coordinateData = record.coordinates.valid
      ? { latitude: record.coordinates.latitude, longitude: record.coordinates.longitude }
      : {};

    const facility = await prisma.facility.upsert({
      where: {
        organizationId_facilityCode: {
          organizationId: organization.id,
          facilityCode: record.facilityCode,
        },
      },
      update: {
        countryId: country.id,
        administrativeUnitId: ward.id,
        name: record.facilityName,
        facilityType: record.facilityType,
        ownershipType: record.ownership,
        address: record.address,
        ...(validPhone ? { contactPhone: validPhone } : {}),
        ...coordinateData,
        status: record.status,
      },
      create: {
        organizationId: organization.id,
        countryId: country.id,
        administrativeUnitId: ward.id,
        name: record.facilityName,
        facilityCode: record.facilityCode,
        facilityType: record.facilityType,
        ownershipType: record.ownership,
        address: record.address,
        contactPhone: validPhone,
        latitude: record.coordinates.latitude,
        longitude: record.coordinates.longitude,
        timezone: 'Africa/Lagos',
        status: record.status,
      },
    });

    for (const contact of record.contacts) {
      await prisma.facilityContact.upsert({
        where: { facilityId_contactKey: { facilityId: facility.id, contactKey: contact.contactKey } },
        update: {
          fullName: contact.fullName,
          jobTitle: 'Officer in Charge',
          phone: contact.phone.raw,
          normalizedPhone: contact.phone.normalized,
          isPhoneValid: contact.phone.valid,
          isPrimary: contact.isPrimary,
          source: SOURCE_NAME,
          sourceRowNumber: contact.sourceRowNumber,
        },
        create: {
          facilityId: facility.id,
          contactKey: contact.contactKey,
          fullName: contact.fullName,
          jobTitle: 'Officer in Charge',
          phone: contact.phone.raw,
          normalizedPhone: contact.phone.normalized,
          isPhoneValid: contact.phone.valid,
          isPrimary: contact.isPrimary,
          source: SOURCE_NAME,
          sourceRowNumber: contact.sourceRowNumber,
        },
      });
      contactsUpserted += 1;
    }
  }

  return {
    organization: organization.name,
    facilitiesUpserted: facilities.length,
    contactsUpserted,
    lgasUpserted: lgaCache.size,
    wardsUpserted: wardCache.size,
  };
}

async function main() {
  const { apply, filePath } = parseArguments();
  const { sourceRecords, facilities } = parseSource(filePath);
  const report = buildReport(sourceRecords, facilities);
  const database = await databasePreview(facilities);

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', filePath, ...report, database }, null, 2));

  if (!apply) {
    console.log('\nPreview only. Re-run with --apply after reviewing this report.');
    return;
  }

  const result = await applyImport(facilities);
  console.log('\nImport completed.');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
