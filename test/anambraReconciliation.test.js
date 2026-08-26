import assert from 'node:assert/strict';
import test from 'node:test';

import { parseWorksheetRows } from '../scripts/anambra/anambraWorkbook.js';
import { reconcileWorkbook } from '../scripts/anambra/anambraReconciliation.js';

function sourceRow(rowNumber, cells = {}) {
  const values = Array(113).fill(null);
  for (const [column, value] of Object.entries(cells)) values[Number(column)] = value;
  return { rowNumber, values };
}

test('merges a cross-sheet administrative duplicate into its HFS facility', () => {
  const lgas = parseWorksheetRows('LGAs', [
    sourceRow(4, { 1: 'Anambra', 2: 'Aguata', 3: 'Ekwulobia I', 4: 'Shared PHC', 31: 'SDD', 36: 'SERIAL-1' }),
  ]);
  const hfs = parseWorksheetRows('HFS', [
    sourceRow(4, { 1: 'Anambra', 2: 'Aguata', 3: 'Ekwulobia I', 4: 'Shared PHC', 31: 'SDD', 36: 'SERIAL-1' }),
  ]);
  const reconciled = reconcileWorkbook([parseWorksheetRows('STATE', []), lgas, hfs]);

  assert.equal(reconciled.facilities.length, 1);
  assert.equal(reconciled.assets.length, 1);
  assert.equal(reconciled.facilities[0].scopeLevel, 'WARD');
  assert.equal(reconciled.assets[0].sourceLocations.length, 2);
});

test('keeps same-named HFS facilities in different wards separate', () => {
  const hfs = parseWorksheetRows('HFS', [
    sourceRow(4, { 1: 'Anambra', 2: 'Awka North', 3: 'Amansea', 4: 'Health Post' }),
    sourceRow(5, { 1: 'Anambra', 2: 'Awka North', 3: 'Amanuke', 4: 'Health Post' }),
  ]);
  const reconciled = reconcileWorkbook([parseWorksheetRows('STATE', []), parseWorksheetRows('LGAs', []), hfs]);

  assert.equal(reconciled.facilities.length, 2);
  assert.notEqual(reconciled.facilities[0].facilityCode, reconciled.facilities[1].facilityCode);
});

test('records and corrects the isolated Anambra-as-LGA source defect', () => {
  const hfs = parseWorksheetRows('HFS', [
    sourceRow(4, { 1: 'Anambra', 2: 'Njikoka', 3: 'Enugwu-Agidi II', 4: 'First Health Post' }),
    sourceRow(5, { 1: 'Anambra', 2: 'Anambra', 3: 'Enugwu-Agidi II', 4: 'Second Health Post' }),
  ]);

  assert.equal(hfs.facilities[1].lga, 'Njikoka');
  assert.ok(hfs.issues.some((issue) => issue.code === 'SOURCE_LGA_CORRECTION'));
});
