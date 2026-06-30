import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const SCRIPT = new URL('./verify-sso-e2e-env.mjs', import.meta.url);

function run(env) {
  return spawnSync(process.execPath, [SCRIPT.pathname], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test('passes for aligned local SSO E2E origins', () => {
  const result = run({
    E2E_WEB_BASE_URL: 'http://127.0.0.1:3003',
    E2E_API_ORIGIN: 'http://127.0.0.1:13100',
    E2E_SSO_ORIGIN: 'http://127.0.0.1:3100',
    E2E_SSO_LOGIN_ORIGIN: 'http://127.0.0.1:3000',
    VIBECODING_APP_BASE_URL: 'http://127.0.0.1:13100',
    VIBECODING_APP_FRONTEND_URL: 'http://127.0.0.1:3003',
    NEXT_PUBLIC_SSO_BASE_URL: 'http://127.0.0.1:3100',
    SSO_ISSUER: 'http://127.0.0.1:3100',
    SSO_API_URL: 'http://127.0.0.1:3100',
    SSO_INTERNAL_API_URL: 'http://127.0.0.1:3100',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /SSO E2E environment is aligned/);
  assert.match(result.stdout, /http:\/\/127\.0\.0\.1:13100\/auth\/oidc\/callback/);
});

test('fails for mismatched or non-http optional origins', () => {
  const result = run({
    E2E_WEB_BASE_URL: 'http://127.0.0.1:3003',
    E2E_API_ORIGIN: 'http://127.0.0.1:13100',
    E2E_SSO_ORIGIN: 'http://127.0.0.1:3100',
    E2E_SSO_LOGIN_ORIGIN: 'http://127.0.0.1:3000',
    VIBECODING_APP_BASE_URL: 'ftp://api.example',
    SSO_ISSUER: 'https://api.sso.test.dofe.ai',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /VIBECODING_APP_BASE_URL .* must use the http or https scheme/);
  assert.match(result.stderr, /SSO_ISSUER .* must match E2E_SSO_ORIGIN/);
});

test('fails for non-http required origins before browser login', () => {
  const result = run({
    E2E_WEB_BASE_URL: 'ftp://files.example',
    E2E_API_ORIGIN: 'file:///tmp/api',
    E2E_SSO_ORIGIN: 'ssh://sso.example',
    E2E_SSO_LOGIN_ORIGIN: 'mailto:login@example.com',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /E2E_WEB_BASE_URL .* must use the http or https scheme/);
  assert.match(result.stderr, /E2E_API_ORIGIN .* must use the http or https scheme/);
  assert.match(result.stderr, /E2E_SSO_ORIGIN .* must use the http or https scheme/);
  assert.match(result.stderr, /E2E_SSO_LOGIN_ORIGIN .* must use the http or https scheme/);
});

test('fails for malformed required and optional origins without throwing', () => {
  const result = run({
    E2E_WEB_BASE_URL: 'bad web',
    E2E_API_ORIGIN: 'bad api',
    E2E_SSO_ORIGIN: 'bad sso',
    E2E_SSO_LOGIN_ORIGIN: 'bad login',
    NEXT_PUBLIC_SERVER_BASE_URL: 'not an api url',
    SSO_API_URL: 'not an sso url',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /E2E_WEB_BASE_URL \(bad web\) must be a valid URL/);
  assert.match(result.stderr, /E2E_API_ORIGIN \(bad api\) must be a valid URL/);
  assert.match(result.stderr, /E2E_SSO_ORIGIN \(bad sso\) must be a valid URL/);
  assert.match(result.stderr, /E2E_SSO_LOGIN_ORIGIN \(bad login\) must be a valid URL/);
  assert.match(result.stderr, /NEXT_PUBLIC_SERVER_BASE_URL \(not an api url\) must be a valid URL/);
  assert.match(result.stderr, /SSO_API_URL \(not an sso url\) must be a valid URL/);
});
