#!/usr/bin/env node
// Plain-Node SSO E2E environment preflight for docs/0629 BUG-01/BUG-02.
//
// This mirrors the lightweight validation in `apps/web/e2e/sso-e2e-env.ts`
// without requiring Playwright or a browser. It lets local/CI runs fail before
// credential entry when API/frontend/SSO origins or callback overrides drift.

const DEFAULT_WEB_BASE_URL = 'http://127.0.0.1:3003';
const DEFAULT_API_ORIGIN = 'http://127.0.0.1:13100';
const DEFAULT_SSO_ORIGIN = 'http://127.0.0.1:3100';
const DEFAULT_SSO_LOGIN_ORIGIN = 'http://127.0.0.1:3000';

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function assertHttpOrigin(name, value, issues) {
  const origin = originOf(value);
  if (!origin) {
    issues.push(`${name} (${value}) must be a valid URL.`);
    return undefined;
  }
  if (!/^https?:\/\//.test(origin)) {
    issues.push(`${name} (${value}) must use the http or https scheme.`);
  }
  return origin;
}

function compareOptionalOrigin({ name, value, expectedName, expectedValue, expectedOrigin, issues }) {
  if (!value) return;
  const origin = originOf(value);
  if (!origin) {
    issues.push(`${name} (${value}) must be a valid URL.`);
    return;
  }
  if (!/^https?:\/\//.test(origin)) {
    issues.push(`${name} (${value}) must use the http or https scheme.`);
    return;
  }
  if (expectedOrigin && origin !== expectedOrigin) {
    issues.push(`${name} (${value}) must match ${expectedName} (${expectedValue}).`);
  }
}

function validate(env) {
  const issues = [];
  const apiOrigin = assertHttpOrigin('E2E_API_ORIGIN', env.apiOrigin, issues);
  const webOrigin = assertHttpOrigin('E2E_WEB_BASE_URL', env.webBaseUrl, issues);
  const ssoOrigin = assertHttpOrigin('E2E_SSO_ORIGIN', env.ssoOrigin, issues);
  assertHttpOrigin('E2E_SSO_LOGIN_ORIGIN', env.ssoLoginOrigin, issues);

  compareOptionalOrigin({
    name: 'NEXT_PUBLIC_SERVER_BASE_URL',
    value: env.serverBaseUrl,
    expectedName: 'E2E_API_ORIGIN',
    expectedValue: env.apiOrigin,
    expectedOrigin: apiOrigin,
    issues,
  });
  compareOptionalOrigin({
    name: 'VIBECODING_APP_BASE_URL',
    value: env.appBaseUrl,
    expectedName: 'E2E_API_ORIGIN',
    expectedValue: env.apiOrigin,
    expectedOrigin: apiOrigin,
    issues,
  });
  compareOptionalOrigin({
    name: 'VIBECODING_APP_FRONTEND_URL',
    value: env.appFrontendUrl,
    expectedName: 'E2E_WEB_BASE_URL',
    expectedValue: env.webBaseUrl,
    expectedOrigin: webOrigin,
    issues,
  });

  for (const [name, value] of [
    ['NEXT_PUBLIC_SSO_BASE_URL', env.ssoBaseUrl],
    ['SSO_ISSUER', env.ssoIssuer],
    ['SSO_API_URL', env.ssoApiUrl],
    ['SSO_INTERNAL_API_URL', env.ssoInternalApiUrl],
  ]) {
    compareOptionalOrigin({
      name,
      value,
      expectedName: 'E2E_SSO_ORIGIN',
      expectedValue: env.ssoOrigin,
      expectedOrigin: ssoOrigin,
      issues,
    });
  }

  return issues;
}

function expectedOidcCallback(apiOrigin) {
  return `${apiOrigin.replace(/\/+$/, '')}/auth/oidc/callback`;
}

const env = {
  webBaseUrl: process.env.E2E_WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL,
  apiOrigin: process.env.E2E_API_ORIGIN ?? process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? DEFAULT_API_ORIGIN,
  ssoOrigin: process.env.E2E_SSO_ORIGIN ?? DEFAULT_SSO_ORIGIN,
  ssoLoginOrigin: process.env.E2E_SSO_LOGIN_ORIGIN ?? DEFAULT_SSO_LOGIN_ORIGIN,
  serverBaseUrl: process.env.NEXT_PUBLIC_SERVER_BASE_URL,
  appBaseUrl: process.env.VIBECODING_APP_BASE_URL,
  appFrontendUrl: process.env.VIBECODING_APP_FRONTEND_URL,
  ssoBaseUrl: process.env.NEXT_PUBLIC_SSO_BASE_URL,
  ssoIssuer: process.env.SSO_ISSUER,
  ssoApiUrl: process.env.SSO_API_URL,
  ssoInternalApiUrl: process.env.SSO_INTERNAL_API_URL,
};

const issues = validate(env);
console.log(`SSO E2E preflight callback: ${expectedOidcCallback(env.apiOrigin)}`);

if (issues.length > 0) {
  console.error('SSO E2E environment is not aligned.');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('SSO E2E environment is aligned.');
