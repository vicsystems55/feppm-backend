import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

const filePath = path.resolve(process.argv[2] ?? '../../gombewithequip.csv');
const rows = parse(fs.readFileSync(filePath, 'utf8'), { bom: true, relax_column_count: true, skip_empty_lines: false });
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const headers = rows[1].map((value, index) => ({ index, name: clean(value) || `(continuation ${index})` }));
const records = rows.slice(3).filter((row) => clean(row[0]) || clean(row[4]));
const equipmentRows = records.filter((row) => /^(yes|equipped)$/i.test(clean(row[30])));
const populated = headers.map((header) => ({ ...header, populated: equipmentRows.filter((row) => clean(row[header.index])).length }));
const values = (index) => [...new Set(equipmentRows.map((row) => clean(row[index])).filter(Boolean))].sort();
const counts = (index) => Object.fromEntries([...records.reduce((map, row) => { const value = clean(row[index]) || '(blank)'; map.set(value, (map.get(value) ?? 0) + 1); return map; }, new Map())].sort((left, right) => right[1] - left[1]));
const equipmentCounts = (index) => Object.fromEntries([...equipmentRows.reduce((map, row) => { const value = clean(row[index]) || '(blank)'; map.set(value, (map.get(value) ?? 0) + 1); return map; }, new Map())].sort((left, right) => right[1] - left[1]));
const key = (row) => `${clean(row[2]).toLowerCase()}|${clean(row[4]).toLowerCase()}|${clean(row[36]).toLowerCase()}|${clean(row[37]).toLowerCase()}`;
const duplicateKeys = new Map();
for (const row of equipmentRows) duplicateKeys.set(key(row), (duplicateKeys.get(key(row)) ?? 0) + 1);

console.log(JSON.stringify({
  filePath,
  rowCount: records.length,
  columnCount: Math.max(...rows.map((row) => row.length)),
  equipmentRows: equipmentRows.length,
  facilitiesWithEquipment: new Set(equipmentRows.map((row) => `${clean(row[2]).toLowerCase()}|${clean(row[4]).toLowerCase()}`)).size,
  lgasWithEquipment: values(2),
  activeCceValues: values(30),
  activeCceCounts: counts(30),
  equipmentCategories: values(31),
  equipmentCategoryCounts: equipmentCounts(31),
  functionalityCounts: equipmentCounts(41),
  manufacturers: values(32),
  models: values(33),
  functionalityValues: values(42),
  energySources: values(46),
  duplicateEquipmentKeys: [...duplicateKeys.entries()].filter(([, count]) => count > 1).length,
  equipmentColumns: populated.filter((item) => item.index >= 30),
  secondaryEquipmentHeaders: Object.fromEntries(rows[2].map((value, index) => [index, clean(value)]).filter(([index, value]) => Number(index) >= 30 && value)),
  samples: equipmentRows.slice(0, 8).map((row) => ({ facility: clean(row[4]), values: Object.fromEntries(headers.filter((item) => item.index >= 30).map((item) => [item.index, clean(row[item.index])])) })),
}, null, 2));
