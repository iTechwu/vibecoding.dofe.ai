# Reliability Next Execution Plan

The sequence prioritizes closure of the remaining network egress risk, then
raises production-flow and regression evidence. Each step should be one PR or
one tightly coupled stack of PRs with its own tests and rollback note.

## Current Status (2026-07-12)

| Step | Status   | Evidence / remaining boundary                                                                                                         |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Partial  | API policy plus browser same-origin redirect guard are implemented. DNS-pinned egress still needs an infrastructure proxy.            |
| 2    | Partial  | CI now runs a deterministic Loops-shell Playwright smoke. Seeded authenticated flow coverage remains.                                 |
| 3    | Blocked  | Prisma JS transform warning is fixed; full API coverage is blocked by existing Istanbul/test-exclude instrumentation incompatibility. |
| 4    | Complete | SDK declaration compatibility check is part of `quality:gate`.                                                                        |
| 5    | Planned  | CI artifact retention exists for browser failures; the operator dashboard and fault-injection cadence remain product work.            |
| 6    | Partial  | API lint is zero-error; 12 API and 32 web warnings remain under a documented warning budget.                                          |

Detailed implementation/verification chronology: [CYCLE-LOG.md](CYCLE-LOG.md).

## Step 1: Complete Browser QA Egress Isolation

**目标**

Make Browser QA navigation resistant to DNS rebinding and redirects to private
networks, not only safe at the initial API validation point.

**范围**

- Introduce a network egress boundary for Playwright that resolves approved
  hosts once and blocks private/reserved addresses for every document
  navigation and redirect.
- Keep an exact production hostname allowlist in deploy-time configuration;
  validate it at startup and expose its readiness without revealing values.
- Add integration tests for redirect-to-private-IP, mixed DNS answers, IPv4,
  IPv6, and explicit local-development override behavior.
- Record blocked navigation reason codes in Loop evidence and operator logs.

**不做**

- Do not add wildcard host matching, CIDR entries, arbitrary URL import, or a
  user-editable allowlist UI.
- Do not grant production access to private networks through the local override.
- Do not redesign the Browser QA report schema beyond the needed reason codes.

**受益**

Closes the remaining redirect and rebinding gap in the highest-risk automated
network path while preserving a clear audit trail for blocked canaries.

## Step 2: Make Critical Loops E2E Required

**目标**

Turn the issue intake-to-evidence and release-canary authorization paths into
required CI evidence, rather than relying only on unit/component tests.

**范围**

- Add a deterministic Playwright CI job with the web/API stack and a seeded
  local test database.
- Cover authenticated issue creation, `Continue Loop`, Browser QA rejection,
  high-risk canary ownership, and visible delivery evidence.
- Upload Playwright traces/screenshots on failure and bound the job with
  retries only for recognized infrastructure failures.
- Keep the existing SSO preflight separate from a real SSO environment test.

**不做**

- Do not require a shared external SSO, Docker daemon, real LLM, or public
  deployment in pull-request CI.
- Do not run visual comparison against unapproved external environments.

**受益**

Detects contract, authentication, UI, and orchestration regressions that
isolated API and React tests cannot observe together.

## Step 3: Establish Coverage and Test-Signal Governance

**目标**

Prevent silent erosion of regression protection and remove recurring warnings
that obscure real test failures.

**范围**

- Configure API and web coverage collection with an initial, evidence-based
  floor for changed files and critical Loops modules.
- Publish coverage summaries as CI artifacts and fail only on agreed threshold
  regressions after the baseline is accepted.
- Update Jest transform rules so generated Prisma JavaScript is not handed to
  `ts-jest` when `allowJs` is disabled.
- Add a small test-runner configuration check for the transform exclusion.

**不做**

- Do not impose an arbitrary repository-wide percentage before baseline data
  exists.
- Do not count generated Prisma output as application coverage.
- Do not suppress warnings globally without fixing their source.

**受益**

Improves CI signal-to-noise and makes test coverage a measurable reliability
control instead of an optional local report.

## Step 4: Add Runtime Dependency Compatibility Evidence

**目标**

Catch published SDK export or semantic changes before they break Loops runtime
adapters, architecture checks, or CI.

**范围**

- Define a compact compatibility suite for the consumed public surfaces of
  `@dofe/infra-docker`, SSO SDKs, and core contract packages.
- Run it after dependency updates and in the CI dependency-audit stage.
- Require upgrade PRs to update compatibility expectations and the reliability
  record when a public SDK contract changes.
- Keep exact direct versions and frozen-lockfile installation checks.

**不做**

- Do not duplicate shared SDK implementation tests in this repository.
- Do not automatically upgrade packages from CI or loosen exact version pins.
- Do not add private-registry credentials to test logs or fixtures.

**受益**

Turns the REL-002/REL-003 class of upgrade drift into a small, actionable
failure close to the dependency change that caused it.

## Step 5: Operationalize Reliability Review

**目标**

Make reliability evidence visible to operators and keep this plan current as
the Loops platform evolves.

**范围**

- Add a release-readiness dashboard section for quality-gate status, E2E
  evidence age, blocked egress attempts, runtime image health, and open
  reliability items.
- Define severity, owner, expiry, and review cadence for reliability findings.
- Add a monthly failure-injection exercise for runner timeout, Docker outage,
  invalid canary target, and dependency incompatibility scenarios.
- Update this directory with the verification output and decision record after
  each completed step.

**不做**

- Do not turn the product dashboard into a raw log viewer.
- Do not expose secrets, allowlist contents, full target URLs, or customer
  evidence to unauthorized users.
- Do not make a dashboard a substitute for CI gates or incident response.

**受益**

Gives operators an early warning surface and converts one-off review work into
a maintained reliability practice.

## Step 6: Restore a Zero-Error Lint Baseline

**目标**

Make `pnpm lint` a dependable required gate by resolving the current API lint
errors and reducing warning debt without hiding real correctness signals.

**范围**

- Apply the existing formatter only to the identified auth formatting errors.
- Replace the empty namespace declaration and forbidden module re-exports using
  the architecture-approved import shape.
- Remove or replace the unavailable `turbo/no-undeclared-env-vars` rule
  reference with the configured rule set.
- Triage the 32 web warnings into behavior-sensitive hooks, unused symbols, and
  image optimization work; fix the high-confidence items first and record a
  warning budget for the remainder.

**不做**

- Do not blanket-disable ESLint rules, raise warning limits, or use generated
  files as a place to hide errors.
- Do not alter SSO/auth behavior merely to satisfy formatting or import rules.
- Do not make web warnings fatal until ownership and an agreed baseline exist.

**受益**

Restores lint as an actionable merge signal, shortens failure diagnosis, and
prevents reliability fixes from accumulating silent static-analysis debt.
