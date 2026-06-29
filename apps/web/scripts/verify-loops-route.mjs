#!/usr/bin/env node
// Deployment/release route verification for BUG-04 (docs/0629).
//
// Probes whether a Loops intake route (`/loops/new`) is reachable on a deployed
// domain — e.g. `vibecoding.test.dofe.ai` — WITHOUT starting the local
// Web/API/SSO stack. A 2xx page or an expected 3xx auth redirect is usable;
// 4xx/5xx or a network failure fails the probe. The exit code reflects the
// result so CI/release scripts can gate on it.
//
// The authoritative status helper is `isUsableLoopsRouteStatus` in
// `../e2e/sso-e2e-env.ts`; this script keeps a minimal copy so it runs with
// plain Node (no TypeScript loader).
//
// Usage:
//   node apps/web/scripts/verify-loops-route.mjs
//   VERIFY_LOOPS_ROUTE_URL=https://vibecoding.test.dofe.ai/loops/new \
//     node apps/web/scripts/verify-loops-route.mjs

const DEFAULT_URL = 'https://vibecoding.test.dofe.ai/loops/new';
const DEFAULT_TIMEOUT_MS = 10_000;
const targetUrl = process.env.VERIFY_LOOPS_ROUTE_URL ?? DEFAULT_URL;
const timeoutMs = Number(process.env.VERIFY_LOOPS_ROUTE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

const isUsableRouteStatus = (status) =>
  typeof status === 'number' && status >= 200 && status < 400;

const outcome = await fetch(targetUrl, {
  method: 'GET',
  redirect: 'manual',
  signal: AbortSignal.timeout(timeoutMs),
}).catch((error) => ({
  status: undefined,
  timedOut: error?.name === 'TimeoutError' || error?.name === 'AbortError',
  error: error instanceof Error ? error.message : String(error),
}));

const status = outcome.status;
const usable = isUsableRouteStatus(status);

console.log(`Loops route probe: ${targetUrl}`);
console.log(`  status: ${status ?? (outcome.timedOut ? 'timeout' : 'network error')}`);
if (outcome.error) console.log(`  error:  ${outcome.error}`);
console.log(`  usable: ${usable}`);

process.exit(usable ? 0 : 1);
