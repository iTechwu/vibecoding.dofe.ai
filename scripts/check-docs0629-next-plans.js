#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const REQUIRED_PARTS = ['目标:', '范围:', '不做:', '受益:'];
const DEFAULT_DOCS_DIRECTORIES = ['docs/0629', 'docs/0712'];

function listMarkdownFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function checkNextExecutionPlans(input) {
  const issues = [];
  const lines = input.content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== 'Next execution plan:') continue;

    const block = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (/^#{1,6}\s/.test(line) || line.trim() === 'Next execution plan:') break;
      block.push(line);
    }

    const missing = REQUIRED_PARTS.filter((part) => !block.some((line) => line.includes(part)));
    if (missing.length > 0) {
      issues.push(
        `${input.file}:${index + 1} Next execution plan is missing ${missing.join(', ')}`,
      );
    }
  }

  return issues;
}

function checkDocsExecutionPlans(rootDir, docsDirectories = DEFAULT_DOCS_DIRECTORIES) {
  const issues = [];

  for (const docsDirectory of docsDirectories) {
    const docsDir = path.join(rootDir, docsDirectory);
    for (const file of listMarkdownFiles(docsDir)) {
      const rel = path.relative(rootDir, file);
      const content = fs.readFileSync(file, 'utf8');
      issues.push(...checkNextExecutionPlans({ file: rel, content }));
    }
  }

  return issues;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const issues = checkDocsExecutionPlans(root);
  if (issues.length > 0) {
    console.error('docs/0629 and docs/0712 next execution plans must include 目标, 范围, 不做, 受益.');
    for (const issue of issues) console.error(issue);
    process.exit(1);
  }
  console.log('docs/0629 and docs/0712 next execution plans include 目标, 范围, 不做, 受益.');
}

if (require.main === module) {
  main();
}

module.exports = {
  checkDocsExecutionPlans,
  checkNextExecutionPlans,
};
