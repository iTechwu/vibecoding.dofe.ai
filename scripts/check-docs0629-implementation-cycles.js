#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const REQUIRED_MARKERS = ['**Implementation:**', '**Validation:**', '**Docs:**'];

function checkImplementationCycles(input) {
  const issues = [];
  const lines = input.content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^## Cycle \d+ /.exec(lines[index]);
    if (!match) continue;

    const block = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (/^## Cycle \d+ /.test(line) || /^### Pass \d+ Final Review/.test(line)) break;
      block.push(line);
    }

    const missing = REQUIRED_MARKERS.filter((marker) => !block.some((line) => line.includes(marker)));
    if (missing.length > 0) {
      issues.push(`${input.file}:${index + 1} ${lines[index].trim()} is missing ${missing.join(', ')}`);
    }
  }

  return issues;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const file = 'docs/0629/IMPLEMENTATION-ANNOTATIONS.md';
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  const issues = checkImplementationCycles({ file, content });

  if (issues.length > 0) {
    console.error('docs/0629 implementation cycles must include Implementation, Validation, and Docs markers.');
    for (const issue of issues) console.error(issue);
    process.exit(1);
  }

  console.log('docs/0629 implementation cycles include Implementation, Validation, and Docs markers.');
}

if (require.main === module) {
  main();
}

module.exports = {
  checkImplementationCycles,
};
