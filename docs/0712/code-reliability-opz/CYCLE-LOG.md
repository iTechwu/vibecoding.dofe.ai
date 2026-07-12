# Reliability Implementation Cycle Log

This log is append-only. Every cycle records implementation, verification,
remaining review observations, and the next selected slice.

## Cycle 1: Restore a Zero-Error Lint Baseline

**实施**

- Removed stale module barrel exports and changed the only `AuthModule`
  consumer to the explicit module path.
- Replaced an unused namespace DTO with an exported interface.
- Removed an ESLint disable for a rule that is no longer configured.
- Applied the repository formatter only to the four files reported by lint.

**标注文档**

- REL-008 is partially complete: API has zero lint errors; 12 API warnings and
  32 web warnings remain as non-blocking debt.

**审查待实施项**

- Step 1 remains the highest-risk item because the spawned Playwright process
  can follow a redirect after the initial URL policy check.
- A browser-side navigation guard must be limited to top-level documents so
  approved pages may still load normal third-party static assets.

**验证**

- `pnpm --filter @repo/api lint` completed with 0 errors.
- `pnpm --filter @repo/api exec jest src/bootstrap/app-module-imports.bootstrap.spec.ts --runInBand` passed (1 test).

**下一循环**: Step 1, browser navigation redirect isolation.

## Cycle 2: Browser QA Redirect Isolation

**实施**

- Added a same-origin navigation predicate for Browser QA.
- Passed the validated origin into the spawned Playwright worker and routed only
  document navigation through that boundary; cross-origin redirects are aborted
  and recorded as network failures.

**标注文档**

- REL-004 is partially complete: cross-origin redirect egress is blocked in the
  browser worker. DNS rebinding at the network-connect layer remains a deploy
  defense-in-depth requirement.

**审查待实施项**

- The API Jest transform currently matches generated `.js` files, causing
  `ts-jest` warnings despite `allowJs: false`.
- Coverage settings already exist in package configs, but the root workflow has
  no single coverage command or artifact publication.

**验证**

- `pnpm --filter @repo/api exec jest libs/domain/services/loops-quality/loops-browser-qa-worker.service.spec.ts --runInBand` passed (9 tests).
- `pnpm --filter @repo/api type-check` passed.

**下一循环**: Step 3, transform exclusion and coverage command.

## Cycle 3: Test Transform Signal

**实施**

- Excluded generated Prisma client JavaScript from `ts-jest` transformation.

**标注文档**

- REL-007 is partially complete: focused Jest runs no longer emit the generated
  JavaScript transform warning.
- REL-006 remains blocked: a full API coverage run fails inside the existing
  Istanbul/test-exclude instrumentation path before affected suites execute.
  The proposed CI coverage job was intentionally not retained.

**审查待实施项**

- The coverage failure is a dependency/toolchain compatibility investigation,
  not a threshold configuration task. It must be reproduced and fixed before
  adding a required CI job.
- SDK compatibility can proceed independently because it uses focused Node
  resolution checks rather than instrumentation.

**验证**

- `pnpm --filter @repo/api exec jest src/modules/loops/loops-target-url-policy.spec.ts --runInBand` passed (6 tests) without the prior transform warning.
- `pnpm --filter @repo/api test:cov` reproduced the instrumentation failure;
  no failing coverage workflow was committed.

**下一循环**: Step 4, SDK compatibility evidence.

## Cycle 4: SDK Compatibility Evidence

**实施**

- Added `check:sdk-compatibility`, which verifies installed exact releases,
  public-entry resolution, and consumed declaration exports for infra Docker and
  SSO SDKs without executing their runtime modules.
- Added the check to `quality:gate`.

**标注文档**

- REL-002/REL-003 now have a continuing compatibility guard in addition to
  exact-version and focused adapter tests.

**审查待实施项**

- A deterministic browser test can run without a shared SSO service if it only
  checks Loops shell availability; real SSO remains separately opt-in.
- CI must install Chromium and retain traces/screenshots on failure.

**验证**

- `pnpm check:sdk-compatibility` passed.

**下一循环**: Step 2, deterministic Loops browser smoke in CI.

## Cycle 5: Required Loops Browser Smoke

**实施**

- Added a Playwright Loops-shell smoke test that rejects server failures and
  requires a non-empty application body.
- Configured the Playwright web server and a CI job that builds web, installs
  Chromium, runs the deterministic spec, and uploads failure artifacts.

**标注文档**

- REL-005 is partially complete: CI now has a required browser execution path.
  Authenticated intake and release-canary flows remain a separate seeded-SSO
  integration milestone.

**审查待实施项**

- REL-004 needs a network-layer, DNS-pinned proxy to close rebinding beyond the
  origin redirect guard.
- REL-006 needs an Istanbul/test-exclude compatibility repair before coverage
  can become a required CI signal.
- Step 5 remains product/operations work; this cycle exposes CI artifacts but
  does not create a dashboard.

**验证**

- `pnpm --filter @repo/web test:e2e -- e2e/loops-shell.spec.ts` passed (1 passed, 1 external SSO test skipped).

**下一循环**: Final review and handoff with the three explicitly bounded
remaining reliability items above.
