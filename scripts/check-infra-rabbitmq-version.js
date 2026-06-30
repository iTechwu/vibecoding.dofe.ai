#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function checkInfraRabbitmqVersion(input) {
  const expected = input.apiPackage.dependencies?.['@dofe/infra-rabbitmq'];
  const issues = [];

  if (!expected) {
    return {
      ok: false,
      expected,
      issues: ['@dofe/infra-rabbitmq is missing from apps/api/package.json dependencies.'],
    };
  }

  const overrideVersion = readLockfileOverride(input.lockfile, '@dofe/infra-rabbitmq');
  if (overrideVersion && overrideVersion !== expected) {
    issues.push(
      `pnpm-lock.yaml override pins @dofe/infra-rabbitmq to ${overrideVersion}, but apps/api/package.json expects ${expected}.`,
    );
  }

  if (!hasImporterVersion(input.lockfile, '@dofe/infra-rabbitmq', expected)) {
    issues.push(
      `pnpm-lock.yaml does not pin the apps/api importer @dofe/infra-rabbitmq version to ${expected}.`,
    );
  }

  return { ok: issues.length === 0, expected, issues };
}

function readLockfileOverride(lockfile, packageName) {
  const match = lockfile.match(new RegExp(`^  '${escapeRegExp(packageName)}':\\s+([^\\n]+)$`, 'm'));
  return match?.[1]?.trim();
}

function hasImporterVersion(lockfile, packageName, expected) {
  const importerPattern = new RegExp(
    String.raw`['"]?${escapeRegExp(packageName)}['"]?:\n\s+specifier:\s+${escapeRegExp(expected)}\n\s+version:\s+${escapeRegExp(expected)}(?:\(|\n)`,
  );
  return importerPattern.test(lockfile);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  const root = path.resolve(__dirname, '..');
  const apiPackage = JSON.parse(
    fs.readFileSync(path.join(root, 'apps/api/package.json'), 'utf8'),
  );
  const lockfile = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
  const result = checkInfraRabbitmqVersion({ apiPackage, lockfile });

  if (!result.ok) {
    for (const issue of result.issues) console.error(issue);
    process.exit(1);
  }

  console.log(`@dofe/infra-rabbitmq lockfile version matches apps/api/package.json (${result.expected}).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkInfraRabbitmqVersion,
  hasImporterVersion,
  readLockfileOverride,
};
