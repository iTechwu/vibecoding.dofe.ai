#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const contractsSchemasDir = path.join(process.cwd(), 'packages', 'contracts', 'src', 'schemas');
const contractsApiDir = path.join(process.cwd(), 'packages', 'contracts', 'src', 'api');
const violations = [];

function walk(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath, predicate);
    }
    return entry.isFile() && predicate(entry.name) ? [fullPath] : [];
  });
}

function lineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function findEndpointName(content, index) {
  const nestedBlockNames = new Set(['body', 'headers', 'pathParams', 'query', 'responses']);
  const lines = content.slice(0, index).split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = lines[i].match(/^\s{2,4}([A-Za-z0-9_]+):\s*{\s*$/);
    if (match && !nestedBlockNames.has(match[1])) {
      return match[1];
    }
  }
  return 'unknown';
}

// Check 1: List response schemas must use PaginatedResponseSchema()
for (const file of walk(contractsSchemasDir, (name) => name.endsWith('.schema.ts'))) {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(process.cwd(), file);
  const declarationPattern =
    /export\s+const\s+([A-Za-z0-9_]*(?:List|List[A-Za-z0-9_]*)ResponseSchema)\s*=\s*([^;]+);/g;

  for (const match of content.matchAll(declarationPattern)) {
    const [, schemaName, initializer] = match;
    if (!initializer.includes('PaginatedResponseSchema(')) {
      violations.push({
        file: relativePath,
        line: lineNumber(content, match.index),
        schemaName,
        reason: 'must use PaginatedResponseSchema(...)',
      });
    }
  }
}

// Check 2: GET endpoints with array responses should use paginated schemas
for (const file of walk(contractsApiDir, (name) => name.endsWith('.contract.ts'))) {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(process.cwd(), file);
  const directArrayResponsePattern = /200\s*:\s*(?:createApiResponse|ApiResponseSchema)\(\s*z\.array\(/g;

  for (const match of content.matchAll(directArrayResponsePattern)) {
    const endpointName = findEndpointName(content, match.index);
    violations.push({
      file: relativePath,
      line: lineNumber(content, match.index),
      schemaName: `${endpointName} direct z.array(...) response`,
      reason: 'GET list endpoints should use PaginatedResponseSchema(...) instead of z.array(...)',
    });
  }
}

console.log('');
console.log('=============================================');
console.log('  List Response Schema Scan');
console.log('=============================================');
console.log('');

if (violations.length > 0) {
  console.log(`VIOLATIONS (${violations.length}):`);
  for (const violation of violations) {
    console.log(
      `  x ${violation.file}:${violation.line}: ${violation.schemaName} ${violation.reason}`,
    );
  }
  console.log('');
  console.log('FAIL: list response schema policy violations found.');
  console.log('See CLAUDE.md → API List Standardization Pattern for guidance.');
  process.exit(1);
}

console.log('PASS: all list response schemas follow the standardized pattern.');
