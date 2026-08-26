import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPreviewReport,
  facilityIdentity,
  normalizeLga,
  normalizeState,
  parseCoordinate,
  parseCoordinatePair,
  parseWorksheetRows,
} from '../scripts/anambra/anambraWorkbook.js';

function sourceRow(rowNumber, cells = {}) {
  const values = Array(113).fill(null);
  for (const [column, value] of Object.entries(cells)) values[Number(column)] = value;
  return { rowNumber, values };
}

test('normalizes known state variants and LGA suffixes', () => {
  assert.equal(normalizeState(' ANAMBAR '), 'Anambra');
  assert.equal(normalizeState('Anambra State'), 'Anambra');
  assert.equal(normalizeLga('AWKA SOUTH LGA'), 'Awka South');
});

test('parses decimal, DMS, and implied-decimal coordinates', () => {
  assert.deepEqual(parseCoordinate(7.0776083, 'longitude'), {
    value: 7.0776083,
    format: 'decimal',
    source: '7.0776083',
  });
  assert.ok(Math.abs(parseCoordinate(`E 7'5'32"`, 'longitude').value - 7.0922222) < 0.000001);
  assert.equal(parseCoordinate(711901, 'longitude').value, 7.11901);
  assert.equal(parseCoordinate(596058, 'latitude').value, 5.96058);
  assert.equal(parseCoordinatePair('not seen', '').classification, 'missing');
  assert.equal(parseCoordinatePair('999', '999').classification, 'invalid');
});

test('attaches asset-only continuation rows to the preceding facility', () => {
  const parsed = parseWorksheetRows('HFS', [
    sourceRow(4, { 1: 'Anambra', 2: 'Aguata', 3: 'Achina 1', 4: 'Oye Achina PHC', 31: 'SDD', 36: 'SERIAL-1' }),
    sourceRow(5, { 31: 'ILR', 36: 'SERIAL-2' }),
  ]);

  assert.equal(parsed.facilities.length, 1);
  assert.equal(parsed.assets.length, 2);
  assert.equal(parsed.continuationRows, 1);
  assert.equal(parsed.assets[1].facilityKey, parsed.facilities[0].key);
});

test('inherits an omitted LGA section but never inherits a ward for a new facility', () => {
  const parsed = parseWorksheetRows('HFS', [
    sourceRow(4, { 1: 'Anambra', 2: 'Aguata', 3: 'Achina 1', 4: 'First PHC' }),
    sourceRow(5, { 4: 'Second PHC' }),
  ]);

  assert.equal(parsed.facilities.length, 2);
  assert.equal(parsed.facilities[1].lga, 'Aguata');
  assert.equal(parsed.facilities[1].ward, null);
  assert.ok(parsed.issues.some((issue) => issue.code === 'MISSING_WARD'));
});

test('quarantines invalid coordinate pairs for review', () => {
  const parsed = parseWorksheetRows('HFS', [
    sourceRow(4, { 1: 'Anambra', 2: 'Aguata', 3: 'Achina 1', 4: 'First PHC', 11: 999, 12: 999 }),
  ]);

  assert.ok(parsed.issues.some((issue) => issue.code === 'INVALID_COORDINATES'));
});

test('facility identities are deterministic across source sheets', () => {
  const identity = facilityIdentity({ state: 'Anambra', lga: 'Aguata', ward: 'Ekwulobia I', facilityName: 'Aguata LGA Cold Store' });
  assert.equal(identity, facilityIdentity({ state: 'ANAMBRA STATE', lga: 'Aguata LGA', ward: 'EKWULOBIA I', facilityName: 'AGUATA LGA COLD STORE' }));
});

test('preview reports cross-sheet facility and asset identifier duplicates without write access', () => {
  const state = parseWorksheetRows('STATE', [
    sourceRow(4, { 1: 'Anambra', 2: 'Awka South', 3: 'Awka 11', 4: 'Shared Store', 31: 'WICR', 36: 'CCE-100' }),
  ]);
  const lgas = parseWorksheetRows('LGAs', [
    sourceRow(4, { 1: 'Anambra', 2: 'Awka South', 3: 'Awka 11', 4: 'Shared Store', 31: 'WICR', 36: 'CCE-100' }),
  ]);
  const hfs = parseWorksheetRows('HFS', []);
  const report = buildPreviewReport({ filePath: 'fixture.xlsx', sourceHash: 'abc', sheets: [state, lgas, hfs] });

  assert.equal(report.databaseWritesEnabled, false);
  assert.equal(report.summary.proposedFacilities, 1);
  assert.equal(report.summary.crossSheetFacilityDuplicateGroups, 1);
  assert.equal(report.summary.duplicateAssetIdentifierGroups, 1);
});
