import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

const SCRIPT = new URL('./verify-loops-route.mjs', import.meta.url);

function listen(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}/loops/new`,
      });
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function runProbe(url, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT.pathname], {
      env: { ...process.env, VERIFY_LOOPS_ROUTE_URL: url, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

test('passes when the Loops route returns a usable redirect', async () => {
  const { server, url } = await listen((_req, res) => {
    res.statusCode = 302;
    res.setHeader('location', '/login');
    res.end();
  });

  try {
    const result = await runProbe(url);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /status: 302/);
    assert.match(result.stdout, /usable: true/);
  } finally {
    await close(server);
  }
});

test('passes when the Loops route returns a usable page', async () => {
  const { server, url } = await listen((_req, res) => {
    res.statusCode = 200;
    res.end('ok');
  });

  try {
    const result = await runProbe(url);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /status: 200/);
    assert.match(result.stdout, /usable: true/);
  } finally {
    await close(server);
  }
});

test('fails when the Loops route returns 404', async () => {
  const { server, url } = await listen((_req, res) => {
    res.statusCode = 404;
    res.end('missing');
  });

  try {
    const result = await runProbe(url);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /status: 404/);
    assert.match(result.stdout, /usable: false/);
  } finally {
    await close(server);
  }
});

test('fails with network error when no server accepts the connection', async () => {
  const { server, url } = await listen((_req, res) => {
    res.statusCode = 200;
    res.end('ok');
  });
  await close(server);

  const result = await runProbe(url);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /status: network error/);
  assert.match(result.stdout, /usable: false/);
});

test('fails before fetch when the probe URL is malformed', async () => {
  const result = await runProbe('not a url');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid VERIFY_LOOPS_ROUTE_URL: not a url/);
  assert.equal(result.stdout, '');
});

test('fails before fetch when the timeout is invalid', async () => {
  const result = await runProbe('http://127.0.0.1:1/loops/new', {
    VERIFY_LOOPS_ROUTE_TIMEOUT_MS: 'abc',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid VERIFY_LOOPS_ROUTE_TIMEOUT_MS: abc/);
  assert.equal(result.stdout, '');
});
