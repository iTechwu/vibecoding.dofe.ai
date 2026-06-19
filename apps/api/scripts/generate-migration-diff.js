#!/usr/bin/env node
/**
 * Generate a Prisma migration diff comparing the live database against
 * the active schema.prisma file.
 *
 * Usage:
 *   node scripts/generate-migration-diff.js                    # print diff to stdout
 *   node scripts/generate-migration-diff.js <migration-name>   # write to a migration directory
 *
 * When a migration name is provided, the output is written to:
 *   prisma/migrations/<YYYYMMDDHHmmss>_<name>/migration.sql
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.resolve(PROJECT_DIR, 'prisma/schema.prisma');
const MIGRATIONS_DIR = path.resolve(PROJECT_DIR, 'prisma/migrations');

function generateTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function runDiff() {
  const args = [
    'npx', 'prisma', 'migrate', 'diff',
    '--from-config-datasource',
    '--to-schema', SCHEMA_PATH,
    '--script',
  ];

  console.log('Comparing database against schema.prisma...\n');

  const sql = execSync(args.join(' '), {
    cwd: PROJECT_DIR,
    encoding: 'utf-8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });

  return sql.trim();
}

const migrationName = process.argv[2];

if (migrationName) {
  // Sanitize the name: lowercase, replace spaces/underscores, keep alphanumeric
  const safeName = migrationName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!safeName) {
    console.error('Error: migration name contains no valid characters.');
    process.exit(1);
  }

  const timestamp = generateTimestamp();
  const dirName = `${timestamp}_${safeName}`;
  const migrationDir = path.join(MIGRATIONS_DIR, dirName);

  fs.mkdirSync(migrationDir, { recursive: true });

  const sql = runDiff();

  if (!sql) {
    console.log('No schema changes detected. Migration directory was not created.');
    fs.rmdirSync(migrationDir);
    process.exit(0);
  }

  const filePath = path.join(migrationDir, 'migration.sql');
  fs.writeFileSync(filePath, sql + '\n');

  console.log(`Migration written to: prisma/migrations/${dirName}/migration.sql`);
} else {
  const sql = runDiff();
  if (sql) {
    console.log(sql);
  } else {
    console.log('No schema changes detected.');
  }
}
