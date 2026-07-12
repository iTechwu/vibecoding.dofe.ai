# Vibecoding Reliability Review and Optimization Record

Date: 2026-07-12

## Scope and Method

This review covers the repository's active production source, workspace and CI
configuration, the Loops orchestration path, contracts, test topology, and
quality gates. Generated Prisma output, historical design records, and cached
artifacts were excluded from source findings unless they affected a build or
test result.

Evidence collected:

- Architecture and source-boundary scan: `pnpm check:architecture`.
- Full quality gate: `pnpm quality:gate`.
- Workspace test topology: 64 test/spec files across API, web, and shared
  packages before this cycle; the Loops domain has broad unit coverage but no
  CI-executed browser E2E suite.
- CI review: `.github/workflows/ci.yml` runs lint/type checks, package/API/web
  tests, a production build, dependency audit, gitleaks, and selected Loops
  doctor commands.
- Manual static review: URL/network egress, subprocess execution, DB service
  boundaries, contracts, source layering, package pinning, and sensitive logs.

## Overall Assessment

The project has a useful reliability foundation: ts-rest/Zod contracts,
separated DB service access, SSO/RBAC guards, Docker hardening, a substantial
Loops test suite, and CI quality checks are already present. The principal
issue was not missing structure but drift between those safeguards and the
current SDK/runtime implementation. This cycle restores the broken controls
and closes the highest-risk unchecked network egress path.

## Findings and Actions

| ID      | Severity | Finding                                                                                                                                                                                                      | Evidence                                                                                       | Status                                                          |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| REL-001 | Critical | Browser QA and release canary accepted user-controlled `targetUrl` values and issued server-side browser/fetch requests. The code itself noted that production needed an SSRF-safe allowlist.                | `apps/api/src/modules/loops/loops.service.ts`; browser worker navigation; release health fetch | Fixed in this cycle                                             |
| REL-002 | Critical | CI's architecture gate pinned stale infra and SSO SDK versions. All direct dependencies had already moved to newer exact versions, so `quality:gate` failed before meaningful validation.                    | `scripts/check-architecture.sh`; 2026-07-10 SDK upgrade commits                                | Fixed in this cycle                                             |
| REL-003 | High     | Docker runtime tests mocked the old `@dofe/infra-docker/docker.utils` API after production migrated to root exports. The mock did not intercept production calls, causing five deterministic false failures. | Full `pnpm test`; `f7cd82b7` implementation migration                                          | Fixed in this cycle                                             |
| REL-004 | High     | Browser QA can still resolve DNS independently after initial validation. Cross-origin document redirects are now blocked, but a DNS-pinned proxy is required to close rebinding at connect time.             | `LoopsBrowserQaWorkerService` launches Playwright in a separate process                        | Partial: redirect guard complete                                |
| REL-005 | High     | CI did not execute a deterministic browser suite.                                                                                                                                                            | `.github/workflows/ci.yml`; `apps/web/e2e/loops-shell.spec.ts`                                 | Partial: Loops shell smoke required; authenticated flow remains |
| REL-006 | Medium   | Coverage settings exist but full API coverage fails in existing Istanbul/test-exclude instrumentation before affected suites run.                                                                            | `pnpm --filter @repo/api test:cov`                                                             | Blocked by toolchain compatibility                              |
| REL-007 | Medium   | API Jest transformed generated Prisma `.js` files despite `allowJs: false`.                                                                                                                                  | `apps/api/jest.config.ts`                                                                      | Fixed                                                           |
| REL-008 | Medium   | Full lint was blocked by nine API errors.                                                                                                                                                                    | `pnpm --filter @repo/api lint`                                                                 | Fixed: 0 API lint errors; warning debt remains                  |

## Implemented Improvements

### REL-001: URL egress policy

`apps/api/src/modules/loops/loops-target-url-policy.ts` now applies one policy
to both public Browser QA and release canary entry points:

- Accept only HTTP(S) URLs without embedded credentials.
- Outside local-like environments, require HTTPS and an explicit
  `LOOPS_TARGET_URL_ALLOWLIST` exact-host entry.
- Resolve every target address before execution and reject private, loopback,
  link-local, shared, multicast, documentation, and other reserved IPv4/IPv6
  ranges.
- Permit private targets only when a local-like environment explicitly sets
  `LOOPS_ALLOW_PRIVATE_TARGET_URLS=true`.
- Disable automatic redirects for the server-side health fetch.

The policy has focused unit tests and a service-level regression proving that
the Browser QA worker is not started for `127.0.0.1`.

### REL-002: Durable SDK alignment check

`scripts/check-architecture.sh` now verifies the invariant the project
actually needs:

- Every direct `@dofe/infra-*` dependency must use an exact version and all
  such dependencies must align to one workspace version.
- Every direct `@dofe/sso-*` dependency must use an exact version; repeated
  references to the same package must agree.

The frozen lockfile remains the installation proof. This preserves drift
detection without encoding an old release number that makes every later,
intentional SDK upgrade fail CI.

### REL-003: Docker adapter test fidelity

The Docker client tests now mock the same root exports that production imports:
`createDockerClient`, `probeDockerDaemon`, `inspectDockerImage`,
`pullDockerImage`, registry-auth resolution, and redaction helpers. Tests
exercise project-owned behavior at the public SDK boundary, including
operator-safe authentication failures and credential redaction.

## Security and Operating Configuration

Production environments that run Browser QA or release canaries must set:

```bash
LOOPS_TARGET_URL_ALLOWLIST=staging.example.com,canary.example.com
```

Entries are exact lowercase hostnames. Do not add broad domains, URLs with
paths, IP ranges, or user-controlled hostnames. Do not set
`LOOPS_ALLOW_PRIVATE_TARGET_URLS` outside local development or test use.

## Verification

Completed after the changes in this record:

- `pnpm check:architecture` passed.
- `pnpm quality:gate` passed, including contracts, sensitive-log, SSO, utility,
  documentation, and full workspace type checks.
- Focused Loops security, service, and Docker adapter suites passed: 3 suites,
  80 tests.
- `pnpm test` passed: API 41 suites / 327 tests passed (1 suite / 9 tests
  skipped), web 16 files / 127 tests passed, and all shared-package suites
  passed.
- `pnpm build` and the final `pnpm build:web` passed.
- `pnpm lint` passed with zero errors. The shared UI package is zero-warning
  under its strict policy; API and web retain 12 and 32 non-blocking warnings
  respectively, tracked as REL-008 warning debt.
- Five implementation/review/documentation cycles are recorded in
  [CYCLE-LOG.md](CYCLE-LOG.md).

## Next Execution Plan

See [NEXT-STEPS.md](NEXT-STEPS.md). Each step has a goal, scope, explicit
non-goals, and benefit so it can become an independently reviewable delivery
slice.
