#!/usr/bin/env node
const { readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
let failed = false;

function fail(message) {
  console.error(`SSO source boundary check failed: ${message}`);
  failed = true;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (['.next', 'coverage', 'dist', 'generated', 'node_modules'].includes(entry)) {
      continue;
    }

    const filePath = path.resolve(dir, entry);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      yield* walk(filePath);
    } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) {
      yield filePath;
    }
  }
}

const forbiddenSourcePatterns = [
  {
    pattern: /LOOPS_RBAC_[A-Z_]+/,
    description: 'Loops local allowlist RBAC; permissions must come from sso.dofe.ai',
  },
  {
    pattern: /\bLoopsRbacGuard\b/,
    description: 'Loops local RBAC guard; use @app/auth PermissionGuard',
  },
  {
    pattern: /@dofe\/infra-shared-services\/file-storage/,
    description: 'local file-storage service import; files are owned by sso.dofe.ai',
  },
  {
    pattern: /\b(FileStorageService|FileStorageServiceModule|BucketResolver)\b/,
    description: 'local file-storage service usage; use @dofe/file-sdk as SSO client',
  },
];

for (const root of ['apps/api/libs', 'apps/api/src', 'packages']) {
  for (const filePath of walk(path.resolve(repoRoot, root))) {
    if (/\.spec\.ts$/.test(filePath)) continue;

    const content = readFileSync(filePath, 'utf8');
    for (const { pattern, description } of forbiddenSourcePatterns) {
      if (pattern.test(content)) {
        fail(`${path.relative(repoRoot, filePath)} contains ${description}`);
      }
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('SSO source boundary check passed');
