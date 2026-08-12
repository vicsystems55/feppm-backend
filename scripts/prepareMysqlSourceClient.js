import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
const sourceSchemaPath = path.join(projectRoot, 'prisma', 'mysql-source.prisma');

const schema = fs.readFileSync(schemaPath, 'utf8');
const sourceSchema = schema
  .replace(
    /generator client \{[\s\S]*?\}/,
    `generator client {
  provider = "prisma-client-js"
  output   = "./generated/mysql-source-client"
}`,
  )
  .replace(
    /datasource db \{[\s\S]*?\}/,
    `datasource db {
  provider = "mysql"
  url      = env("MYSQL_SOURCE_URL")
}`,
  );

fs.writeFileSync(sourceSchemaPath, sourceSchema);

const prismaCliPath = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(
  process.execPath,
  [prismaCliPath, 'generate', '--schema', sourceSchemaPath],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      MYSQL_SOURCE_URL: process.env.MYSQL_SOURCE_URL
        || 'mysql://root:@127.0.0.1:3306/feppm',
    },
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log('Temporary MySQL source client is ready.');
