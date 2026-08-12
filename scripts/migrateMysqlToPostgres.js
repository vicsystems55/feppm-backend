import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Prisma as TargetPrisma, PrismaClient as TargetPrismaClient } from '@prisma/client';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const sourceClientPath = path.join(
  projectRoot,
  'prisma',
  'generated',
  'mysql-source-client',
  'index.js',
);
const batchSize = Math.max(10, Math.min(1000, Number(process.env.MIGRATION_BATCH_SIZE ?? 250)));
const mysqlSourceUrl = process.env.MYSQL_SOURCE_URL;

if (!mysqlSourceUrl) {
  throw new Error('MYSQL_SOURCE_URL is required. It must point to the source MySQL database.');
}
if (!process.env.DATABASE_URL?.startsWith('postgres')) {
  throw new Error('DATABASE_URL must point to the PostgreSQL migration target.');
}
if (!fs.existsSync(sourceClientPath)) {
  throw new Error('MySQL source client is missing. Run `npm run migration:prepare-mysql` first.');
}

function constrainedSourceUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'mysql:') {
    throw new Error('MYSQL_SOURCE_URL must use the mysql protocol.');
  }
  if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
  if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '30');
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15');
  return url.toString();
}

const sourceModule = await import(pathToFileURL(sourceClientPath));
const { Prisma: SourcePrisma, PrismaClient: SourcePrismaClient } = sourceModule;
const source = new SourcePrismaClient({ datasourceUrl: constrainedSourceUrl(mysqlSourceUrl) });
const target = new TargetPrismaClient();

function delegateName(modelName) {
  return `${modelName[0].toLowerCase()}${modelName.slice(1)}`;
}

function scalarFields(model) {
  return model.fields.filter((field) => field.kind === 'scalar' || field.kind === 'enum');
}

function relationDetails(model) {
  return model.fields
    .filter((field) => field.kind === 'object' && field.relationFromFields?.length)
    .map((field) => ({
      targetModel: field.type,
      fromFields: field.relationFromFields,
      required: field.isRequired,
    }));
}

function orderedModels(models) {
  const modelNames = new Set(models.map(({ name }) => name));
  const remaining = new Map(models.map((model) => [model.name, model]));
  const completed = new Set();
  const ordered = [];

  while (remaining.size) {
    const ready = [...remaining.values()].filter((model) => relationDetails(model)
      .filter((relation) => relation.required && relation.targetModel !== model.name)
      .every((relation) => !modelNames.has(relation.targetModel) || completed.has(relation.targetModel)));

    if (!ready.length) {
      throw new Error(`Required relation cycle detected among: ${[...remaining.keys()].join(', ')}`);
    }

    ready.sort((left, right) => left.name.localeCompare(right.name));
    for (const model of ready) {
      ordered.push(model);
      completed.add(model.name);
      remaining.delete(model.name);
    }
  }

  return ordered;
}

function normalizeValue(value) {
  if (value === null || value === undefined) return value;
  if (
    SourcePrisma.Decimal?.isDecimal?.(value)
    || value.constructor?.isDecimal?.(value)
    || (
      typeof value.toFixed === 'function'
      && Array.isArray(value.d)
      && Number.isInteger(value.e)
    )
  ) {
    return value.toFixed();
  }
  if (value instanceof Date || Buffer.isBuffer(value) || value instanceof Uint8Array) return value;
  if (typeof value === 'bigint') return value;
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeValue(nestedValue)]),
    );
  }
  return value;
}

function createData(model, record, copiedModels, deferred) {
  const data = Object.fromEntries(
    scalarFields(model).map(({ name }) => [name, normalizeValue(record[name])]),
  );

  for (const relation of relationDetails(model)) {
    const deferRelation = !relation.required && (
      relation.targetModel === model.name || !copiedModels.has(relation.targetModel)
    );
    if (!deferRelation) continue;

    const values = Object.fromEntries(
      relation.fromFields
        .filter((fieldName) => record[fieldName] !== null && record[fieldName] !== undefined)
        .map((fieldName) => [fieldName, normalizeValue(record[fieldName])]),
    );
    if (Object.keys(values).length) deferred.push({ model, record, values });
    for (const fieldName of relation.fromFields) data[fieldName] = null;
  }

  return data;
}

function uniqueWhere(model, record) {
  const idField = model.fields.find((field) => field.isId);
  if (idField) return { [idField.name]: normalizeValue(record[idField.name]) };

  const fields = model.primaryKey?.fields ?? [];
  if (!fields.length) throw new Error(`Cannot patch ${model.name}: it has no primary key.`);
  const key = model.primaryKey.name || fields.join('_');
  return {
    [key]: Object.fromEntries(fields.map((fieldName) => [fieldName, normalizeValue(record[fieldName])])),
  };
}

async function assertEmptyTarget(models) {
  const occupied = [];
  for (const model of models) {
    const count = await target[delegateName(model.name)].count();
    if (count) occupied.push(`${model.name}=${count}`);
  }
  if (occupied.length) {
    throw new Error(
      `PostgreSQL target must be empty before migration. Existing records: ${occupied.join(', ')}`,
    );
  }
}

async function validateModelCompatibility(sourceModels, targetModels) {
  const targetByName = new Map(targetModels.map((model) => [model.name, model]));
  for (const sourceModel of sourceModels) {
    const targetModel = targetByName.get(sourceModel.name);
    if (!targetModel) throw new Error(`Target Prisma client is missing model ${sourceModel.name}.`);
    const sourceFieldNames = scalarFields(sourceModel).map(({ name }) => name).sort();
    const targetFieldNames = scalarFields(targetModel).map(({ name }) => name).sort();
    if (sourceFieldNames.join('|') !== targetFieldNames.join('|')) {
      throw new Error(`Source and target scalar fields differ for ${sourceModel.name}.`);
    }
  }
}

async function run() {
  const sourceModels = SourcePrisma.dmmf.datamodel.models;
  const targetModels = TargetPrisma.dmmf.datamodel.models;
  await validateModelCompatibility(sourceModels, targetModels);
  const models = orderedModels(sourceModels);
  await assertEmptyTarget(models);

  const copiedModels = new Set();
  const deferred = [];
  const report = [];

  for (const model of models) {
    const delegate = delegateName(model.name);
    const sourceCount = await source[delegate].count();
    let copied = 0;

    while (copied < sourceCount) {
      const records = await source[delegate].findMany({ skip: copied, take: batchSize });
      if (!records.length) break;
      const data = records.map((record) => createData(model, record, copiedModels, deferred));
      const result = await target[delegate].createMany({ data });
      copied += records.length;
      if (result.count !== records.length) {
        throw new Error(`${model.name}: expected to insert ${records.length}, inserted ${result.count}.`);
      }
    }

    copiedModels.add(model.name);
    report.push({ model: model.name, source: sourceCount, copied });
    console.log(`${model.name}: ${copied}/${sourceCount}`);
  }

  console.log(`Restoring ${deferred.length} deferred nullable relation values...`);
  for (const item of deferred) {
    await target[delegateName(item.model.name)].update({
      where: uniqueWhere(item.model, item.record),
      data: item.values,
    });
  }

  let mismatch = false;
  for (const item of report) {
    const destination = await target[delegateName(item.model)].count();
    item.destination = destination;
    if (destination !== item.source) mismatch = true;
  }

  console.table(report.filter(({ source }) => source > 0));
  if (mismatch) throw new Error('Migration count validation failed.');
  console.log(`Migration validated across ${report.length} Prisma models.`);
}

try {
  await run();
} finally {
  await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
}
