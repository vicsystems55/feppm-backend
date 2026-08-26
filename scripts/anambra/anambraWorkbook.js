import crypto from 'node:crypto';
import fs from 'node:fs';

import ExcelJS from 'exceljs';

export const EXPECTED_SHEETS = ['STATE', 'LGAs', 'HFS'];
export const HEADER_ROW = 3;
export const DATA_START_ROW = 4;

export const ASSET_BLOCKS = [
  { key: 'coldChain', label: 'Cold Chain Equipment', start: 31, end: 52, identifiers: [36, 37, 50] },
  { key: 'passiveColdChain', label: 'Passive Cold Chain Equipment', start: 53, end: 58, identifiers: [58] },
  { key: 'temperatureMonitoring', label: 'Temperature Monitoring Device', start: 59, end: 64, identifiers: [62] },
  { key: 'powerHvac', label: 'Power and HVAC Equipment', start: 65, end: 76, identifiers: [76] },
  { key: 'ict', label: 'ICT Equipment', start: 77, end: 85, identifiers: [85] },
  { key: 'transport', label: 'Transport Equipment', start: 86, end: 94, identifiers: [94] },
  { key: 'wasteManagement', label: 'Waste Management Equipment', start: 95, end: 106, identifiers: [106] },
  { key: 'toolsSafety', label: 'Maintenance Tools and Safety Equipment', start: 107, end: 112, identifiers: [] },
];

const PLACEHOLDERS = new Set([
  '', 'n a', 'na', 'nil', 'none', 'non', 'not applicable', 'not aplicable',
  'not seen', 'unknown', 'unknow', 'unkown', 'unkwon',
]);

const ACRONYMS = new Set(['BHCPF', 'BHPHC', 'CCE', 'GH', 'HC', 'HP', 'ICT', 'LGA', 'MCH', 'PHC', 'PHCC', 'TMD']);

export const ANAMBRA_LGAS = [
  'Aguata', 'Anambra East', 'Anambra West', 'Anaocha', 'Awka North', 'Awka South',
  'Ayamelum', 'Dunukofia', 'Ekwusigo', 'Idemili North', 'Idemili South', 'Ihiala',
  'Njikoka', 'Nnewi North', 'Nnewi South', 'Ogbaru', 'Onitsha North', 'Onitsha South',
  'Orumba North', 'Orumba South', 'Oyi',
];
const LGA_NAMES = new Map(ANAMBRA_LGAS.map((name) => [normalizedKey(name), name]));

export function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? '').join('');
    if ('result' in value) return cellText(value.result);
    if ('text' in value) return cellText(value.text);
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

export function normalizedKey(value) {
  return cellText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isMeaningful(value) {
  return !PLACEHOLDERS.has(normalizedKey(value));
}

export function titleCase(value) {
  return cellText(value)
    .toLowerCase()
    .split(' ')
    .map((word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      return word ? `${word[0].toUpperCase()}${word.slice(1)}` : word;
    })
    .join(' ');
}

export function normalizeState(value) {
  const key = normalizedKey(value);
  if (['anambra', 'anambar', 'anambra state'].includes(key)) return 'Anambra';
  return titleCase(value);
}

export function normalizeLga(value) {
  const withoutSuffix = cellText(value).replace(/\bLGA\b/gi, '').trim();
  return LGA_NAMES.get(normalizedKey(withoutSuffix)) ?? titleCase(withoutSuffix.replace(/[-_/]+/g, ' '));
}

export function hash(value, length = 16) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, length).toUpperCase();
}

function inRange(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function parseCoordinate(value, axis) {
  const source = cellText(value);
  if (!source || !isMeaningful(source)) return { value: null, format: 'missing', source };

  const hemisphere = source.match(/[NSEW]/i)?.[0]?.toUpperCase();
  const parts = source.replace(/[NSEW]/gi, '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  let parsed = null;
  let format = 'invalid';

  if (parts.length >= 2) {
    parsed = Math.abs(parts[0]) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
    if (parts[0] < 0 || ['S', 'W'].includes(hemisphere)) parsed *= -1;
    format = 'dms';
  } else if (parts.length === 1) {
    parsed = parts[0];
    format = 'decimal';
  }

  const bounds = axis === 'longitude' ? [2, 15] : [4, 14];
  if (!inRange(parsed, ...bounds) && Number.isInteger(parsed) && Math.abs(parsed) >= 10_000) {
    const candidates = [];
    for (let divisor = 10; divisor <= 10_000_000; divisor *= 10) {
      const candidate = parsed / divisor;
      if (inRange(candidate, ...bounds)) candidates.push(candidate);
    }
    if (candidates.length === 1) {
      [parsed] = candidates;
      format = 'implied-decimal';
    }
  }

  if (!inRange(parsed, ...bounds)) return { value: null, format: 'invalid', source };
  return { value: parsed, format, source };
}

export function parseCoordinatePair(longitudeValue, latitudeValue) {
  const longitude = parseCoordinate(longitudeValue, 'longitude');
  const latitude = parseCoordinate(latitudeValue, 'latitude');
  const valid = longitude.value != null && latitude.value != null;

  return {
    longitude: longitude.value,
    latitude: latitude.value,
    valid,
    classification: valid
      ? (longitude.format === 'decimal' && latitude.format === 'decimal' ? 'decimal' : 'converted')
      : (longitude.format === 'missing' && latitude.format === 'missing' ? 'missing' : 'invalid'),
    sourceLongitude: longitude.source,
    sourceLatitude: latitude.source,
  };
}

export function facilityIdentity({ state, lga, ward, facilityName }) {
  return [normalizeState(state), normalizeLga(lga), ward, facilityName]
    .filter(Boolean)
    .map(normalizedKey)
    .join('|');
}

function contactIdentity(name, phone) {
  const digits = cellText(phone).replace(/\D/g, '');
  return hash(digits ? `phone:${digits}` : `name:${normalizedKey(name)}`, 32);
}

function normalizePhone(value) {
  const raw = cellText(value);
  let normalized = raw.replace(/\D/g, '');
  if (normalized.startsWith('234') && normalized.length === 13) normalized = `0${normalized.slice(3)}`;
  if (normalized.length === 10 && /^[789]/.test(normalized)) normalized = `0${normalized}`;
  return { raw: raw || null, normalized: normalized || null, valid: /^0[789]\d{9}$/.test(normalized) };
}

function rowHasAsset(row, block) {
  return row.slice(block.start, block.end + 1).some(isMeaningful);
}

function assetCandidate(row, block, context) {
  const identifiers = block.identifiers
    .map((index) => cellText(row[index]))
    .filter(isMeaningful)
    .map((value) => ({ raw: value, normalized: normalizedKey(value).replace(/\s+/g, '') }));
  const category = isMeaningful(row[block.start]) ? cellText(row[block.start]) : null;
  const manufacturer = isMeaningful(row[block.start + 1]) ? cellText(row[block.start + 1]) : null;
  const model = isMeaningful(row[block.start + 2]) ? cellText(row[block.start + 2]) : null;
  const fingerprint = hash([
    context.facilityKey, block.key, normalizedKey(category), normalizedKey(manufacturer),
    normalizedKey(model), context.sheet, context.rowNumber,
  ].join('|'), 24);

  return {
    sheet: context.sheet,
    rowNumber: context.rowNumber,
    facilityKey: context.facilityKey,
    block: block.key,
    blockLabel: block.label,
    category,
    manufacturer,
    model,
    identifiers,
    values: row.slice(block.start, block.end + 1).map(cellText),
    fingerprint,
  };
}

function mergeFacility(existing, candidate) {
  existing.sourceRows.push(candidate.firstSourceRow);
  if (candidate.ward) existing.wards.add(candidate.ward);
  if (!existing.ward && candidate.ward) existing.ward = candidate.ward;
  if (!existing.address && candidate.address) existing.address = candidate.address;
  if (!existing.coordinates.valid && candidate.coordinates.valid) existing.coordinates = candidate.coordinates;
  if (candidate.contact) existing.contacts.set(candidate.contact.key, candidate.contact);
  return existing;
}

export function parseWorksheetRows(sheetName, rows) {
  const facilities = new Map();
  const assets = [];
  const issues = [];
  let lastState = '';
  let lastLga = '';
  let currentFacility = null;
  let populatedRows = 0;
  let continuationRows = 0;

  for (const source of rows) {
    const row = source.values ?? source;
    const rowNumber = source.rowNumber ?? 0;
    if (!row.some(isMeaningful)) continue;
    populatedRows += 1;

    const explicitState = isMeaningful(row[1]) ? normalizeState(row[1]) : '';
    let explicitLga = isMeaningful(row[2]) ? normalizeLga(row[2]) : '';
    const explicitWard = isMeaningful(row[3]) ? titleCase(row[3]) : '';
    const rawFacilityName = cellText(row[4]);
    const hasFacilityName = isMeaningful(rawFacilityName) && normalizedKey(rawFacilityName).length > 1;
    const assetBlocks = ASSET_BLOCKS.filter((block) => rowHasAsset(row, block));

    if (normalizedKey(explicitLga) === 'anambra' && normalizeState(explicitState || lastState) === 'Anambra' && lastLga) {
      issues.push({
        code: 'SOURCE_LGA_CORRECTION',
        sheet: sheetName,
        rowNumber,
        sourceValue: cellText(row[2]),
        correctedValue: lastLga,
      });
      explicitLga = lastLga;
    }

    if (explicitState) lastState = explicitState;
    if (explicitLga) lastLga = explicitLga;

    if (hasFacilityName) {
      const state = explicitState || lastState;
      const lga = explicitLga || lastLga;
      const facilityName = titleCase(rawFacilityName);
      if (!state || !lga) {
        issues.push({ code: 'MISSING_HIERARCHY', sheet: sheetName, rowNumber, facilityName });
        currentFacility = null;
      } else {
        const baseKey = facilityIdentity({ state, lga, facilityName });
        const key = facilityIdentity({
          state,
          lga,
          ward: sheetName === 'HFS' ? explicitWard : null,
          facilityName,
        });
        const coordinates = parseCoordinatePair(row[11], row[12]);
        const contactName = isMeaningful(row[28]) ? titleCase(row[28]) : null;
        const contactPhone = isMeaningful(row[29]) ? cellText(row[29]) : null;
        const normalizedPhone = normalizePhone(contactPhone);
        const contact = contactName ? {
          key: contactIdentity(contactName, contactPhone),
          role: 'Officer in Charge',
          hasPhone: Boolean(contactPhone),
          fullName: contactName,
          phone: normalizedPhone.raw,
          normalizedPhone: normalizedPhone.normalized,
          isPhoneValid: normalizedPhone.valid,
          sourceRowNumber: rowNumber,
        } : null;
        const candidate = {
          key,
          baseKey,
          sheet: sheetName,
          state,
          lga,
          ward: explicitWard || null,
          wards: new Set(explicitWard ? [explicitWard] : []),
          facilityName,
          address: isMeaningful(row[8]) ? cellText(row[8]) : null,
          details: {
            sourceFacilityType: isMeaningful(row[5]) ? cellText(row[5]) : null,
            healthFacilityCategory: isMeaningful(row[6]) ? cellText(row[6]) : null,
            classification: isMeaningful(row[7]) ? cellText(row[7]) : null,
            totalPopulation: isMeaningful(row[9]) ? cellText(row[9]) : null,
            targetPopulationUnderOne: isMeaningful(row[10]) ? cellText(row[10]) : null,
            supplyingStore: isMeaningful(row[13]) ? cellText(row[13]) : null,
            subFacilityCount: isMeaningful(row[14]) ? cellText(row[14]) : null,
            functioning: isMeaningful(row[15]) ? cellText(row[15]) : null,
            cceEquipped: isMeaningful(row[16]) ? cellText(row[16]) : null,
            ownership: isMeaningful(row[17]) ? cellText(row[17]) : null,
            providesImmunization: isMeaningful(row[22]) ? cellText(row[22]) : null,
            functionalIcepackCount: isMeaningful(row[23]) ? cellText(row[23]) : null,
            buildingSuitable: isMeaningful(row[24]) ? cellText(row[24]) : null,
            hasGenerator: isMeaningful(row[25]) ? cellText(row[25]) : null,
            nationalGridHours: isMeaningful(row[26]) ? cellText(row[26]) : null,
            staffCount: isMeaningful(row[27]) ? cellText(row[27]) : null,
          },
          coordinates,
          contacts: new Map(contact ? [[contact.key, contact]] : []),
          firstSourceRow: rowNumber,
          sourceRows: [rowNumber],
        };
        currentFacility = facilities.has(key)
          ? mergeFacility(facilities.get(key), candidate)
          : candidate;
        facilities.set(key, currentFacility);
      }
    } else if (assetBlocks.length > 0) {
      if (currentFacility) continuationRows += 1;
      else issues.push({ code: 'ORPHAN_ASSET_ROW', sheet: sheetName, rowNumber, blocks: assetBlocks.map((block) => block.key) });
    } else if (rawFacilityName) {
      issues.push({ code: 'INVALID_FACILITY_NAME', sheet: sheetName, rowNumber });
      currentFacility = null;
    }

    if (currentFacility) {
      for (const block of assetBlocks) {
        assets.push(assetCandidate(row, block, {
          sheet: sheetName,
          rowNumber,
          facilityKey: currentFacility.key,
        }));
      }
    }
  }

  const normalizedFacilities = [...facilities.values()].map((facility) => ({
    ...facility,
    wards: [...facility.wards],
    contacts: [...facility.contacts.values()],
  }));
  for (const facility of normalizedFacilities) {
    if (facility.wards.length > 1) {
      issues.push({
        code: 'CONFLICTING_WARDS',
        sheet: sheetName,
        facilityKey: facility.key,
        sourceRows: facility.sourceRows,
        wards: facility.wards,
      });
    }
    if (!facility.ward) {
      issues.push({ code: 'MISSING_WARD', sheet: sheetName, facilityKey: facility.key, sourceRows: facility.sourceRows });
    }
    if (facility.coordinates.classification === 'invalid') {
      issues.push({
        code: 'INVALID_COORDINATES',
        sheet: sheetName,
        facilityKey: facility.key,
        sourceRows: facility.sourceRows,
        longitude: facility.coordinates.sourceLongitude,
        latitude: facility.coordinates.sourceLatitude,
      });
    }
  }

  return { sheetName, populatedRows, continuationRows, facilities: normalizedFacilities, assets, issues };
}

function duplicateGroups(values, keySelector) {
  const groups = new Map();
  for (const value of values) {
    const key = keySelector(value);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  }
  return [...groups.entries()].filter(([, records]) => records.length > 1);
}

function countBy(values, keySelector) {
  const counts = new Map();
  for (const value of values) {
    const key = keySelector(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function buildPreviewReport({ filePath, sourceHash, sheets }) {
  const facilities = sheets.flatMap((sheet) => sheet.facilities);
  const assets = sheets.flatMap((sheet) => sheet.assets);
  const issues = sheets.flatMap((sheet) => sheet.issues);
  const facilityDuplicates = duplicateGroups(facilities, (facility) => facility.baseKey);
  const identifiers = assets.flatMap((asset) => asset.identifiers.map((identifier) => ({
    ...identifier,
    sheet: asset.sheet,
    rowNumber: asset.rowNumber,
    block: asset.block,
    facilityKey: asset.facilityKey,
  })));
  const identifierDuplicates = duplicateGroups(identifiers, (identifier) => identifier.normalized);
  const uniqueFacilityKeys = new Set(facilities.map((facility) => facility.key));

  return {
    mode: 'preview-only',
    databaseWritesEnabled: false,
    source: { filePath, sha256: sourceHash, sheets: sheets.map((sheet) => sheet.sheetName) },
    summary: {
      populatedRows: sheets.reduce((total, sheet) => total + sheet.populatedRows, 0),
      proposedFacilities: uniqueFacilityKeys.size,
      proposedContacts: facilities.reduce((total, facility) => total + facility.contacts.length, 0),
      proposedAssets: assets.length,
      continuationRows: sheets.reduce((total, sheet) => total + sheet.continuationRows, 0),
      issueCount: issues.length,
      crossSheetFacilityDuplicateGroups: facilityDuplicates.filter(([, records]) => new Set(records.map((record) => record.sheet)).size > 1).length,
      duplicateAssetIdentifierGroups: identifierDuplicates.length,
    },
    bySheet: Object.fromEntries(sheets.map((sheet) => [sheet.sheetName, {
      populatedRows: sheet.populatedRows,
      facilityCandidates: sheet.facilities.length,
      contacts: sheet.facilities.reduce((total, facility) => total + facility.contacts.length, 0),
      assetCandidates: sheet.assets.length,
      continuationRows: sheet.continuationRows,
      issues: sheet.issues.length,
    }])),
    assetsByBlock: countBy(assets, (asset) => asset.block),
    coordinates: countBy(facilities, (facility) => facility.coordinates.classification),
    issuesByCode: countBy(issues, (issue) => issue.code),
    reconciliation: {
      crossSheetFacilityDuplicates: facilityDuplicates
        .filter(([, records]) => new Set(records.map((record) => record.sheet)).size > 1)
        .slice(0, 25)
        .map(([key, records]) => ({
          key,
          occurrences: records.length,
          locations: records.slice(0, 20).map((record) => ({ sheet: record.sheet, rows: record.sourceRows.slice(0, 20) })),
        })),
      duplicateAssetIdentifiers: identifierDuplicates.slice(0, 25).map(([identifier, records]) => ({
        identifier,
        occurrences: records.length,
        locations: records.slice(0, 20).map((record) => ({ sheet: record.sheet, rowNumber: record.rowNumber, block: record.block })),
      })),
      issueSamples: issues.slice(0, 50).map((issue) => ({
        ...issue,
        ...(issue.sourceRows ? { sourceRows: issue.sourceRows.slice(0, 20), sourceRowCount: issue.sourceRows.length } : {}),
        ...(issue.wards ? { wards: issue.wards.slice(0, 20), wardCount: issue.wards.length } : {}),
      })),
    },
  };
}

export async function parseWorkbookFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Workbook not found: ${filePath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const names = workbook.worksheets.map((worksheet) => worksheet.name);
  const missingSheets = EXPECTED_SHEETS.filter((name) => !names.includes(name));
  if (missingSheets.length) throw new Error(`Workbook is missing required sheets: ${missingSheets.join(', ')}`);

  const sheets = EXPECTED_SHEETS.map((sheetName) => {
    const worksheet = workbook.getWorksheet(sheetName);
    if (normalizedKey(worksheet.getRow(HEADER_ROW).getCell(5).value) !== 'facility name') {
      throw new Error(`Sheet ${sheetName} does not have the expected three-row header.`);
    }
    const rows = [];
    for (let rowNumber = DATA_START_ROW; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const values = [];
      for (let column = 1; column <= 113; column += 1) {
        values.push(worksheet.getRow(rowNumber).getCell(column).value);
      }
      rows.push({ rowNumber, values });
    }
    return parseWorksheetRows(sheetName, rows);
  });
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  return { sheets, report: buildPreviewReport({ filePath, sourceHash, sheets }) };
}
