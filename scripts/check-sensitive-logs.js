#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const scanDirs = [
  path.join(rootDir, 'apps', 'api', 'src'),
  path.join(rootDir, 'apps', 'api', 'libs', 'domain'),
];

const sensitiveKeys = [
  'accessToken',
  'access_token',
  'authorization',
  'backupCode',
  'backupCodes',
  'clientSecret',
  'client_secret',
  'codeVerifier',
  'code_verifier',
  'idToken',
  'id_token',
  'password',
  'refreshToken',
  'refresh_token',
  'secret',
  'token',
];

const safeKeys = new Set([
  'clientId',
  'codePrefix',
  'error',
  'errorDescription',
  'grantType',
  'hasCode',
  'hasCodeVerifier',
  'hasRedirectUri',
  'redirectUri',
  'tokenType',
  'userId',
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'generated'].includes(entry.name)) return [];
      return walk(fullPath);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
    if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.ts')) return [];
    return [fullPath];
  });
}

function relative(file) {
  return path.relative(rootDir, file).split(path.sep).join('/');
}

function findLoggerCall(lines, start) {
  const collected = [];
  let depth = 0;
  let started = false;

  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    collected.push(line);
    for (const char of line) {
      if (char === '(') {
        depth += 1;
        started = true;
      } else if (char === ')') {
        depth -= 1;
      }
    }
    if (started && depth <= 0) {
      return { end: i, text: collected.join('\n') };
    }
  }

  return { end: start, text: collected.join('\n') };
}

const violations = [];
const loggerPattern = /\b(?:this\.)?logger\.(info|warn|error|debug)\s*\(/;
const keyPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
const stringLiteralPattern = /(['"`])(?:\\.|(?!\1)[\s\S])*\1/g;

for (const file of walk(scanDirs[0]).concat(walk(scanDirs[1]))) {
  const rel = relative(file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    if (!loggerPattern.test(lines[i])) continue;
    const call = findLoggerCall(lines, i);

    const metadataText = call.text.replace(stringLiteralPattern, '');
    for (const match of metadataText.matchAll(keyPattern)) {
      const key = match[1];
      if (!sensitiveKeys.includes(key) || safeKeys.has(key)) continue;
      violations.push({
        file: rel,
        line: i + 1,
        key,
      });
    }

    i = call.end;
  }
}

console.log('');
console.log('=============================================');
console.log('  Sensitive Log Field Scan');
console.log('=============================================');
console.log('');

if (violations.length > 0) {
  console.log(`VIOLATIONS (${violations.length}):`);
  for (const violation of violations) {
    console.log(
      `  x ${violation.file}:${violation.line}: logger metadata includes "${violation.key}"`,
    );
  }
  console.log('');
  console.log('FAIL: logger metadata should not include raw sensitive fields.');
  process.exit(1);
}

console.log('PASS: logger metadata does not include raw sensitive fields.');
