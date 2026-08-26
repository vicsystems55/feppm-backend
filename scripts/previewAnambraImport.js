import path from 'node:path';

import { parseWorkbookFile } from './anambra/anambraWorkbook.js';

const DEFAULT_FILE = path.resolve(
  process.cwd(),
  '..',
  '..',
  'new dbs',
  "Anambra State & LGAs & Health Facilities' CCE Data_Updated_27032026 (1).xlsx",
);

function parseArguments() {
  const fileArgument = process.argv.slice(2).find((argument) => argument.startsWith('--file='));
  if (process.argv.slice(2).includes('--apply')) {
    throw new Error('Phase 1 is preview-only. Database apply mode is intentionally unavailable.');
  }
  return { filePath: path.resolve(fileArgument ? fileArgument.slice('--file='.length) : DEFAULT_FILE) };
}

async function main() {
  const { filePath } = parseArguments();
  const { report } = await parseWorkbookFile(filePath);
  console.log(JSON.stringify(report, null, 2));
  console.log('\nPreview complete. No database connection was opened and no records were written.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
