import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('loops status CLI starts and returns a queue summary', () => {
  const result = spawnSync('pnpm', ['loops:status'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 60_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const summary = JSON.parse(result.stdout);
  assert.equal(typeof summary.issues, 'number');
  assert.ok(Array.isArray(summary.loops));
});
