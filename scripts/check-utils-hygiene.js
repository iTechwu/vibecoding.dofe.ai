#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const utilsDir = path.join(rootDir, 'packages', 'utils');

// Baseline for historical generic utility APIs. New console/any usage in
// packages/utils must be removed or intentionally reviewed before adding here.
const allowedMatches = new Set([]);

const violationPattern =
  /\bconsole\.(log|error|warn|debug|info)\(|\bas any\b|:\s*any\b|\bany\[\]|\bRecord<string,\s*any>\b|\[key:\s*string\]:\s*any\b|\bT\s*=\s*any\b/g;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.turbo', '__tests__'].includes(entry.name)) return [];
      return walk(fullPath);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) {
      return [];
    }
    return [fullPath];
  });
}

function relative(file) {
  return path.relative(rootDir, file).split(path.sep).join('/');
}

const violations = [];
const observedAllowedMatches = new Set();

for (const file of walk(utilsDir)) {
  const rel = relative(file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    violationPattern.lastIndex = 0;
    if (!violationPattern.test(line)) return;

    const key = `${rel}:${index + 1}`;
    if (!allowedMatches.has(key)) {
      violations.push({ file: rel, line: index + 1, text: line.trim() });
    } else {
      observedAllowedMatches.add(key);
    }
  });
}

const staleAllowedMatches = [...allowedMatches].filter((key) => !observedAllowedMatches.has(key));

console.log('');
console.log('=============================================');
console.log('  Utils Hygiene Scan');
console.log('=============================================');
console.log('');

if (violations.length > 0 || staleAllowedMatches.length > 0) {
  if (violations.length > 0) {
    console.log(`VIOLATIONS (${violations.length}):`);
    for (const violation of violations) {
      console.log(`  x ${violation.file}:${violation.line}: ${violation.text}`);
    }
    console.log('');
  }

  if (staleAllowedMatches.length > 0) {
    console.log(`STALE ALLOWLIST (${staleAllowedMatches.length}):`);
    for (const key of staleAllowedMatches) {
      console.log(`  x ${key}`);
    }
    console.log('');
  }

  console.log('FAIL: packages/utils hygiene baseline is not current.');
  process.exit(1);
}

console.log('PASS: packages/utils has no new console/any production usage.');
