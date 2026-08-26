import { hash, isMeaningful, normalizedKey, titleCase } from './anambraWorkbook.js';

const SHEET_PRIORITY = { HFS: 3, LGAs: 2, STATE: 1 };
const BLOCK_CODES = {
  coldChain: 'CCE',
  passiveColdChain: 'PASSIVE',
  temperatureMonitoring: 'TMD',
  powerHvac: 'POWER',
  ict: 'ICT',
  transport: 'VEHICLE',
  wasteManagement: 'WASTE',
  toolsSafety: 'TOOLS',
};

function sourceId(sheet, key) {
  return `${sheet}|${key}`;
}

function facilityCode(facility) {
  const scope = normalizedKey(facility.lga || 'state').replace(/\s+/g, '').slice(0, 5).toUpperCase();
  return `ANM-${scope}-${hash(facility.key, 8)}`;
}

function mergeContacts(target, source) {
  const contacts = new Map(target.contacts.map((contact) => [contact.key, contact]));
  for (const contact of source.contacts) if (!contacts.has(contact.key)) contacts.set(contact.key, contact);
  target.contacts = [...contacts.values()];
}

function mergeFacility(target, source) {
  target.sourceLocations.push({ sheet: source.sheet, rows: source.sourceRows });
  mergeContacts(target, source);
  if (!target.address && source.address) target.address = source.address;
  if (!target.coordinates.valid && source.coordinates.valid) target.coordinates = source.coordinates;
  target.details = { ...source.details, ...target.details };
  return target;
}

function canonicalFacility(source) {
  const scopeLevel = source.sheet === 'HFS' ? 'WARD' : source.sheet === 'LGAs' ? 'LGA' : 'STATE';
  return {
    ...source,
    scopeLevel,
    sourceLocations: [{ sheet: source.sheet, rows: source.sourceRows }],
  };
}

function mergeAsset(target, source) {
  const identifiers = new Map(target.identifiers.map((identifier) => [identifier.normalized, identifier]));
  for (const identifier of source.identifiers) identifiers.set(identifier.normalized, identifier);
  target.identifiers = [...identifiers.values()];
  target.sourceLocations.push({ sheet: source.sheet, rowNumber: source.rowNumber });
  target.values = target.values.map((value, index) => value || source.values[index] || '');
  return target;
}

function reconcileAssets(assets, facilitySourceMap, issues) {
  const canonicalAssets = [];
  const identifierIndex = new Map();

  const sortedAssets = [...assets].sort((left, right) => (
    left.facilityKey.localeCompare(right.facilityKey)
      || left.block.localeCompare(right.block)
      || left.sheet.localeCompare(right.sheet)
      || left.rowNumber - right.rowNumber
  ));

  for (const source of sortedAssets) {
    const canonicalFacilityKey = facilitySourceMap.get(sourceId(source.sheet, source.facilityKey));
    if (!canonicalFacilityKey) {
      issues.push({ code: 'UNRESOLVED_ASSET_FACILITY', sheet: source.sheet, rowNumber: source.rowNumber });
      continue;
    }
    const identityKeys = source.identifiers.map((identifier) => `${canonicalFacilityKey}|${source.block}|${identifier.normalized}`);
    const matches = [...new Set(identityKeys.map((key) => identifierIndex.get(key)).filter(Boolean))];
    let asset;
    if (matches.length > 1) {
      issues.push({
        code: 'AMBIGUOUS_ASSET_IDENTITY',
        sheet: source.sheet,
        rowNumber: source.rowNumber,
        facilityKey: canonicalFacilityKey,
        matchingAssetCodes: matches.map((match) => match.assetCode),
      });
      [asset] = matches;
    } else if (matches.length === 1) {
      [asset] = matches;
      mergeAsset(asset, source);
    } else {
      const primaryIdentity = source.identifiers.map((identifier) => identifier.normalized).sort()[0]
        ?? `${source.sheet.toLowerCase()}-${source.rowNumber}`;
      const blockCode = BLOCK_CODES[source.block] ?? 'ASSET';
      asset = {
        ...source,
        facilityKey: canonicalFacilityKey,
        sourceLocations: [{ sheet: source.sheet, rowNumber: source.rowNumber }],
        assetCode: `ANM-${blockCode}-${hash(`${canonicalFacilityKey}|${source.block}|${primaryIdentity}`, 10)}`,
      };
      canonicalAssets.push(asset);
    }
    for (const identifier of asset.identifiers) {
      identifierIndex.set(`${canonicalFacilityKey}|${asset.block}|${identifier.normalized}`, asset);
    }
  }

  const identifiersAcrossFacilities = new Map();
  for (const asset of canonicalAssets) {
    for (const identifier of asset.identifiers) {
      const key = `${asset.block}|${identifier.normalized}`;
      if (!identifiersAcrossFacilities.has(key)) identifiersAcrossFacilities.set(key, []);
      identifiersAcrossFacilities.get(key).push(asset);
    }
  }
  for (const [identifier, records] of identifiersAcrossFacilities) {
    const facilityKeys = [...new Set(records.map((record) => record.facilityKey))];
    if (facilityKeys.length > 1) {
      issues.push({
        code: 'CROSS_FACILITY_ASSET_IDENTIFIER',
        identifier,
        facilityCount: facilityKeys.length,
        assetCodes: records.slice(0, 20).map((record) => record.assetCode),
      });
    }
  }

  return canonicalAssets;
}

export function reconcileWorkbook(sheets) {
  const parsedFacilities = sheets.flatMap((sheet) => sheet.facilities);
  const parsedAssets = sheets.flatMap((sheet) => sheet.assets);
  const issues = sheets.flatMap((sheet) => sheet.issues.map((issue) => ({ ...issue, stage: 'source' })));
  const facilitySourceMap = new Map();
  const canonicalFacilities = [];
  const hfsByBaseKey = new Map();

  for (const facility of parsedFacilities.filter((record) => record.sheet === 'HFS')) {
    const canonical = canonicalFacility(facility);
    canonicalFacilities.push(canonical);
    facilitySourceMap.set(sourceId(facility.sheet, facility.key), canonical.key);
    if (!hfsByBaseKey.has(facility.baseKey)) hfsByBaseKey.set(facility.baseKey, []);
    hfsByBaseKey.get(facility.baseKey).push(canonical);
  }

  const administrativeGroups = new Map();
  for (const facility of parsedFacilities.filter((record) => record.sheet !== 'HFS')) {
    if (!administrativeGroups.has(facility.baseKey)) administrativeGroups.set(facility.baseKey, []);
    administrativeGroups.get(facility.baseKey).push(facility);
  }

  for (const [baseKey, records] of administrativeGroups) {
    const hfsMatches = hfsByBaseKey.get(baseKey) ?? [];
    if (hfsMatches.length === 1) {
      const [target] = hfsMatches;
      for (const record of records) {
        mergeFacility(target, record);
        facilitySourceMap.set(sourceId(record.sheet, record.key), target.key);
      }
      issues.push({ code: 'CROSS_SHEET_FACILITY_MERGED', stage: 'reconciliation', baseKey, sheets: [target.sheet, ...records.map((record) => record.sheet)] });
      continue;
    }
    if (hfsMatches.length > 1) {
      issues.push({ code: 'AMBIGUOUS_CROSS_SHEET_FACILITY', stage: 'reconciliation', baseKey, hfsMatches: hfsMatches.map((record) => record.key) });
    }

    const selected = [...records].sort((left, right) => SHEET_PRIORITY[right.sheet] - SHEET_PRIORITY[left.sheet])[0];
    const canonical = canonicalFacility(selected);
    canonicalFacilities.push(canonical);
    for (const record of records) {
      if (record !== selected) mergeFacility(canonical, record);
      facilitySourceMap.set(sourceId(record.sheet, record.key), canonical.key);
    }
    if (records.length > 1) {
      issues.push({ code: 'CROSS_SHEET_FACILITY_MERGED', stage: 'reconciliation', baseKey, sheets: records.map((record) => record.sheet) });
    }
  }

  for (const facility of canonicalFacilities) facility.facilityCode = facilityCode(facility);
  const assets = reconcileAssets(parsedAssets, facilitySourceMap, issues);

  return { facilities: canonicalFacilities, assets, issues, facilitySourceMap };
}

export function facilityTypeFor(source) {
  const type = normalizedKey(source.details?.sourceFacilityType);
  const classification = normalizedKey(source.details?.classification);
  if (type.includes('vaccine cold store')) return 'WAREHOUSE';
  if (classification === 'hp' || classification.includes('health post')) return 'HEALTH_POST';
  if (type.includes('tertiary') || classification.includes('teaching')) return 'TEACHING_HOSPITAL';
  if (classification.includes('specialist')) return 'SPECIALIST_HOSPITAL';
  if (type.includes('secondary') || classification.includes('general') || classification === 'gh') return 'GENERAL_HOSPITAL';
  if (type.includes('primary') || classification.includes('phc') || classification.includes('health centre')) return 'PRIMARY_HEALTH_CENTRE';
  return 'OTHER';
}

export function ownershipTypeFor(source) {
  const ownership = normalizedKey(source.details?.ownership);
  if (ownership.includes('private')) return 'PRIVATE';
  if (ownership.includes('faith')) return 'FAITH_BASED';
  if (ownership.includes('ngo')) return 'NGO';
  if (ownership.includes('federal')) return 'FEDERAL';
  if (ownership.includes('state')) return 'STATE';
  if (ownership.includes('lga')) return 'LGA';
  if (ownership.includes('public')) return 'PUBLIC';
  return null;
}

export function equipmentTypeFor(asset) {
  const rawCategory = asset.category && isMeaningful(asset.category) ? asset.category : asset.blockLabel;
  return titleCase(rawCategory);
}

export function manufacturerFor(asset) {
  return asset.manufacturer && isMeaningful(asset.manufacturer) ? titleCase(asset.manufacturer) : 'Unknown Manufacturer';
}

export function modelFor(asset) {
  return asset.model && isMeaningful(asset.model) ? asset.model.toUpperCase().replace(/\s+/g, ' ').trim() : 'Unknown Model';
}

export function yesNo(value) {
  const key = normalizedKey(value);
  if (['yes', 'y', 'true', '1', 'functional', 'functioning'].includes(key)) return true;
  if (['no', 'n', 'false', '0', 'non functional', 'not functional'].includes(key)) return false;
  return null;
}

export function numericValue(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function validYear(value) {
  const number = Math.trunc(numericValue(value));
  return number >= 1950 && number <= new Date().getFullYear() ? number : null;
}

export function functionalityFor(value) {
  const key = normalizedKey(value);
  if (['yes', 'functional', 'functioning', 'active'].includes(key)) return 'FUNCTIONAL';
  if (key.includes('partial')) return 'PARTIALLY_FUNCTIONAL';
  if (key.includes('repair')) return 'UNDER_REPAIR';
  if (['no', 'non functional', 'not functional', 'faulty'].includes(key)) return 'NON_FUNCTIONAL';
  if (key.includes('decommission') || key.includes('obsolete')) return 'DECOMMISSIONED';
  return 'UNKNOWN';
}

export function buildReconciliationReport(reconciled) {
  const issueCounts = new Map();
  for (const issue of reconciled.issues) issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
  const assetsByBlock = new Map();
  for (const asset of reconciled.assets) assetsByBlock.set(asset.block, (assetsByBlock.get(asset.block) ?? 0) + 1);
  return {
    phase: 2,
    canonicalFacilities: reconciled.facilities.length,
    canonicalContacts: reconciled.facilities.reduce((total, facility) => total + facility.contacts.length, 0),
    canonicalAssets: reconciled.assets.length,
    facilitiesUsingUnspecifiedWard: reconciled.facilities.filter((facility) => facility.scopeLevel === 'WARD' && !facility.ward).length,
    facilitiesWithoutCoordinates: reconciled.facilities.filter((facility) => !facility.coordinates.valid).length,
    assetsByBlock: Object.fromEntries([...assetsByBlock.entries()].sort()),
    issuesByCode: Object.fromEntries([...issueCounts.entries()].sort()),
    issueSamples: reconciled.issues.slice(0, 50).map((issue) => ({
      ...issue,
      ...(issue.sourceRows ? { sourceRows: issue.sourceRows.slice(0, 20) } : {}),
    })),
  };
}
