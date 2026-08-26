import fs from 'node:fs';
import path from 'node:path';

import { parseWorkbookFile } from './anambra/anambraWorkbook.js';
import { buildReconciliationReport, reconcileWorkbook } from './anambra/anambraReconciliation.js';

const DEFAULT_FILE = path.resolve(
  process.cwd(), '..', '..', 'new dbs',
  "Anambra State & LGAs & Health Facilities' CCE Data_Updated_27032026 (1).xlsx",
);
const DEFAULT_OUTPUT = path.resolve(process.cwd(), 'reports', 'generated', 'anambra-reconciliation.json');

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return path.resolve(value ? value.slice(prefix.length) : fallback);
}

async function main() {
  const filePath = argument('file', DEFAULT_FILE);
  const outputPath = argument('output', DEFAULT_OUTPUT);
  const { sheets, report: sourcePreview } = await parseWorkbookFile(filePath);
  const reconciliation = buildReconciliationReport(reconcileWorkbook(sheets));
  const report = {
    mode: 'reconciliation-only',
    databaseWritesEnabled: false,
    source: sourcePreview.source,
    sourcePreview: sourcePreview.summary,
    reconciliation,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, ...reconciliation }, null, 2));
  console.log('\nReconciliation complete. No database connection was opened.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
