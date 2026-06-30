# Agent Runtime Platform Optimizations

Date: 2026-06-29

## Test Evidence

Runtime endpoint tested with local controlled auth bypass:

- `GET /loops/agent-runtime`
- `GET /loops/workspaces`

Observed runtime state:

- Codex local CLI: ready, `codex-cli 0.141.0`
- Claude Code local CLI: ready, `2.1.186 (Claude Code)`
- Docker fallback images: missing for both runtimes
- Workspace: `default`
- Active test issue: `issue-20260629-a55aca10` in `PHASE_2_REVIEW`

Final follow-up validation:

- Turbo local env pass-through was verified with `MODE_USER_ID=... pnpm
dev:api`; protected Loops routes returned `200`.
- RabbitMQ credential-bearing startup logs and shutdown severity were reproduced
  during the original API smoke run, then closed through the upstream
  `@dofe/infra-rabbitmq` fix and consumed in this repo via `0.1.80`.
- Cycle 91 real browser SSO validation found two remaining execution-harness
  concerns: Playwright needs an explicit test-only HTTPS trust switch for the
  remote test SSO mkcert chain, and the login portal origin is
  `https://sso.test.dofe.ai` while the SSO API origin is
  `https://api.sso.test.dofe.ai`.
- 2026-06-30 rerun confirmed runtime readiness is healthy in controlled API
  validation: `GET /loops/agent-runtime` returned Codex local CLI
  `codex-cli 0.141.0`, Claude Code `2.1.186`, and Docker fallback ready for
  both. The same run reproduced RabbitMQ credential-bearing startup logs and
  optional shutdown error noise.

## Optimization Items

### OPZ-01: Make Runtime Docker Fallback Readiness Actionable

Observed:

- The runtime contract reports `DOCKER_IMAGE_MISSING` with action `pull-image`
  for both Codex and Claude Code.
- The UI surfaces readiness, but the end-to-end test still relied on local CLI.

Status:

- Implemented in Cycle 8 at the runtime dashboard UI level.
- Hardened in Cycle 17 at the runtime service level.
- The runtime detection card now keeps the visible `Pull image` action for
  `DOCKER_IMAGE_MISSING`, shows an in-progress `Pulling image...` state for the
  active runtime, and re-runs runtime detection after the pull mutation
  succeeds.
- Dashboard regression coverage now verifies the degraded Docker fallback state,
  `pull-image` mutation payload, and post-pull detection retry.
- `LoopsWorkspaceProfileService.pullImage` now skips redundant pulls when the
  image is already present, verifies local inspectability after a successful
  pull, and reports a failed readiness state if the image cannot be inspected
  after pull completion.
- Cycle 21 closes the UI handoff for that service state: dashboard pull actions
  now surface a returned `failed` message inline and avoid retrying runtime
  detection when the image is not ready locally.
- Cycle 26 extends the same inline feedback to rejected pull requests, so API or
  network failures do not become unhandled UI errors.
- Cycle 31 adds retry regression coverage proving a successful retry clears the
  previous inline pull error and triggers runtime redetection.
- Cycle 38 adds post-pull readiness inspection exception handling so a Docker
  inspect failure returns a structured `failed` pull response instead of
  surfacing a lower-level exception.
- Cycle 44 adds the same structured failure behavior for the initial pre-pull
  image inspection, avoiding API exceptions before the pull attempt starts.
- Cycle 46 wraps the Docker `pull` call itself in the same structured-failure
  boundary, so a rejecting pull client (for example a Docker client that fails
  to construct) returns `failed` instead of propagating an unhandled exception.
  It also adds a regression proving `pullImage` rejects with `Workspace not
found` before any Docker interaction when the workspace id is unknown.
- Cycle 62 runs the fallback path against a real Docker daemon (v29.5.3): the
  UCloud Hub pinned images are publicly pullable with no registry credentials,
  and after `docker pull` both pinned digests inspect as present, so `pullImage`
  resolves to `already-present`. The not-present → pull → present and
  already-present branches are now verified on a real daemon, not only in mocks.

Next execution plan:

- 目标: Keep Docker fallback preparation covered during future runtime changes.
- 范围: Retain the service/UI regression matrix and the Cycle 62 real-daemon
  evidence; if pinned runtime image digests change, rerun the dashboard action
  or `POST /loops/workspaces/:workspaceId/pull-image` for Codex and Claude Code,
  then confirm `/loops/agent-runtime` reports the selected Docker candidate as
  ready.
- 不做: Do not change pinned image digests or registry credential storage in this
  pass.
- 受益: Runtime fallback stays usable when local CLI is unavailable, improving
  reliability for operators and CI-like environments.

### OPZ-02: Align Local/Test OAuth Host Configuration

Observed:

- Local API generated an OAuth redirect URI under
  `https://api.vibecoding.local.dofe.ai/auth/oidc/callback`.
- Project SSO docs recommend `vibecoding.test.dofe.ai` and list local
  `127.0.0.1:13100` callback as allowed.
- The generated local callback was rejected by SSO.

Status:

- Repository-side alignment is implemented across Cycles 1, 5, and 9.
- `resolveOidcApiBaseUrl` and `resolveOidcFrontendBaseUrl` accept explicit
  local/test env overrides.
- `turbo.json` passes the override variables through local dev tasks.
- `apps/api/.env.example` and `apps/web/.env.example` now document the required
  callback/frontend URL and SSO tier alignment for real browser E2E.
- Cycle 13 adds a Web E2E preflight validator for API/frontend/SSO origin
  alignment and the expected OIDC callback URL.
- Cycle 16 extends the preflight to validate `SSO_INTERNAL_API_URL` against the
  same local/test SSO tier.
- Cycle 75 adds a plain-Node `verify-sso-e2e-env.mjs` entry point, Cycle 81
  adds required-origin non-http(s) regression coverage for that CLI, and Cycle
  87 adds malformed required/optional URL coverage.

Next execution plan:

- 目标: Verify local/test SSO configuration against the SSO client registration.
- 范围: Run with the documented env overrides and confirm the SSO OAuth client
  allows `http://127.0.0.1:13100/auth/oidc/callback`; use
  `node apps/web/scripts/verify-sso-e2e-env.mjs` before
  `pnpm --filter @repo/web test:e2e:sso` to fail fast on local env mismatches.
- 不做: Do not change production `vibecoding.dofe.ai` callback behavior.
- 受益: Real-account E2E can run without patching config or bypassing auth.

### OPZ-03: Remove Secret-Like URLs From Routine Startup Logs

Status: Repository-owned defense layer implemented in Cycle 52. The observed
RabbitMQ lifecycle logging comes from the upstream `@dofe/infra-rabbitmq`
package, which injects the shared `WINSTON_MODULE_PROVIDER` logger, so its
connection logs flow through the logger this repository configures.
`createAppWinstonConfig` now prepends a `redactSecretUrls` winston format that
rewrites `scheme://user:pass@` authorities to `scheme://***@` before any
transport sees them, masking credentials in connection URLs and nested error
meta even before the upstream package masks them itself. The upstream
root-cause fix is still the preferred long-term resolution because it also
covers the package's `console.*` paths (e.g. `rabbitmq-events.module.js`) that
bypass winston. Cycle 57 locks the
redaction depth-cap / non-crash contract with regressions for circular
references and deeply nested meta, so the defense layer cannot regress into a
stack overflow. Cycle 63 lands the upstream root-cause fix in
`infra.dofe.ai/packages/rabbitmq`: `redactUrlCredentials` / `redactErrorMessage`
are applied at the events-module connect log, the events-module connection-error
log, and the service init/connection error logs, with a `node --test` smoke
test. Cycle 68 locks app-layer redaction for URL-encoded credentials. Cycle 70
aligns `apps/api/package.json` and `pnpm-lock.yaml` to
`@dofe/infra-rabbitmq@0.1.80`, and Cycle 71 adds
`check:infra-rabbitmq-version` to prevent package/lockfile drift.
Cycle 91 observed API startup output that still included a RabbitMQ connection
URL with credentials in the console stream while running `pnpm dev:api`. Keep
this item open until the exact dev log path is confirmed to flow through the
updated redaction layer or is fixed upstream; do not paste credential-bearing
log lines into QA artifacts.

2026-06-30 rerun still prints RabbitMQ connection URLs with credentials during
`pnpm dev:api` startup in the `init`, `connect`, and `Attempting to connect`
messages. The evidence was observed in terminal output; credential-bearing
lines are intentionally not copied verbatim into this artifact beyond the
pattern description.

Observed:

- Startup logs print full RabbitMQ connection URLs.
- Local env also contains registry and SSO secrets, so routine logs should avoid
  normalizing secret-bearing patterns.

Next execution plan:

- 目标: Keep RabbitMQ credential redaction active after the infra package bump.
- 范围: Maintain `@dofe/infra-rabbitmq@0.1.80` in `apps/api/package.json` and
  `pnpm-lock.yaml`; run `pnpm check:infra-rabbitmq-version` in quality gates;
  trace the exact `pnpm dev:api` logger path for RabbitMQ module lifecycle logs
  and add a startup-log smoke that rejects `scheme://user:pass@` patterns in
  terminal output.
- 不做: Do not remove useful host/service diagnostics.
- 受益: Logs remain useful while reducing leakage risk during QA, screenshots,
  or issue reports.

### OPZ-04: Normalize Optional RabbitMQ Shutdown Logging

Status: Root-cause fix landed upstream in Cycle 64 (`infra.dofe.ai/packages/rabbitmq`)
and is now consumed by this repo through `@dofe/infra-rabbitmq@0.1.80` (Cycle 70).
The service close handler now downgrades the "RabbitMQ connection closed" log to
`debug` when `isShuttingDown` is true (set by `onModuleDestroy`), so a benign
shutdown race no longer surfaces as `warn` alongside the graceful-close log. The
decision is extracted as `connectionClosedSeverity(isShuttingDown)` with a
`node --test` smoke test. `check:infra-rabbitmq-version` now prevents the
package.json / lockfile pair from drifting back to an older package.
Cycle 91 shutdown still reproduced `Error closing RabbitMQ connection` with
`Connection closing` at `error` level before the graceful-close log, so the
runtime behavior in this repo is not yet fully aligned with the expected
upstream shutdown-severity fix.

2026-06-30 rerun reproduced the same shutdown behavior on SIGINT: repeated
graceful shutdown notices, then `Error closing RabbitMQ connection` with
`Connection closing` at `error` level, followed by
`RabbitMQ connection closed gracefully`.

Observed:

- On SIGINT, API shutdown logs `Error closing RabbitMQ connection` with
  `Connection closing`, then immediately logs graceful close.
- This happened twice during the test.

Next execution plan:

- 目标: Keep optional RabbitMQ shutdown logs at the corrected severity.
- 范围: Keep `@dofe/infra-rabbitmq@0.1.80` pinned and lockfile-aligned; run the
  version drift check in CI/quality gates; additionally trace why this repo's
  dev shutdown path still emits `Connection closing` at error level despite the
  package bump, and verify the exact package/runtime path used by `pnpm dev:api`.
- 不做: Do not suppress real connection failures during startup or message
  processing.
- 受益: Operators can distinguish harmless shutdown races from real queue
  reliability problems.

### OPZ-05: Turbo Dev Environment Pass-through for Auth Bypass

Status: Implemented in Cycle 5. `turbo.json` now passes through local bypass,
preview, OIDC URL override, SSO, and internal API variables needed for local E2E.

Observed:

- Starting API with `MODE_USER_ID=... pnpm dev:api` still returned 401.
- Starting Nest directly from `apps/api` with the same env enabled bypass.

Next execution plan:

- 目标: Verify local bypass through the normal dev script.
- 范围: Run `MODE_USER_ID=... pnpm dev:api` and confirm protected Loops routes
  no longer return false 401 responses; the previous follow-up validation
  already observed protected Loops routes returning `200`, so rerun only when
  auth bypass or Turbo env pass-through changes.
- 不做: Do not enable bypass in production or preview deployments.
- 受益: Local smoke tests can exercise protected flows without confusing false
  auth failures.

### OPZ-06: Make Real SSO E2E Harness Explicit About Test TLS and Login Origin

Status: Partially implemented in Cycle 91. `apps/web/playwright.config.ts` now
honors `E2E_IGNORE_HTTPS_ERRORS=1`, defaulting to strict certificate validation.
The real browser run also established that `E2E_SSO_LOGIN_ORIGIN` must be
`https://sso.test.dofe.ai` when `E2E_SSO_ORIGIN` is
`https://api.sso.test.dofe.ai`.

Observed:

- Without a Playwright HTTPS override, browser requests to the remote test SSO
  failed with `ERR_CERT_AUTHORITY_INVALID`.
- With the override enabled, the browser reached the SSO login portal and
  submitted credentials successfully.
- The initial assumption that login and API origins both used
  `https://api.sso.test.dofe.ai` caused a pre-login origin assertion failure.

Next execution plan:

- 目标: Keep real SSO E2E setup repeatable and safe.
- 范围: Document the remote-test command with
  `E2E_SSO_ORIGIN=https://api.sso.test.dofe.ai`,
  `E2E_SSO_LOGIN_ORIGIN=https://sso.test.dofe.ai`, and
  `E2E_IGNORE_HTTPS_ERRORS=1`; consider adding the ignore-HTTPS flag to the
  plain-Node preflight output as a warning when the SSO issuer uses the test
  mkcert chain.
- 不做: Do not make HTTPS ignoring the default, and do not apply it to
  production or release-domain validation.
- 受益: Operators can reproduce real browser SSO tests without weakening normal
  browser security.

### OPZ-07: Extend SSO Preflight Beyond Local Env Shape

Status: Open from 2026-06-30 rerun.

Observed:

- The local SSO E2E preflight passed and printed the expected callback URL.
- The remote SSO authorize endpoint then rejected that same callback with
  `redirect_uri not allowed`.
- The preflight currently proves local origin alignment, but not the remote SSO
  client allow-list that ultimately gates browser login.

Next execution plan:

- 目标: Make SSO readiness checks cover the remote allow-list dependency.
- 范围: Add a non-secret SSO client registration probe or signed admin-side
  diagnostic for the test environment; report whether
  `vibecoding-dofe-ai` accepts
  `http://127.0.0.1:13100/auth/oidc/callback` before browser automation starts;
  keep the existing local URL shape validation as the first stage.
- 不做: Do not expose client secrets, tokens, authorization codes, or the test
  password in CLI output, traces, or docs.
- 受益: Operators can distinguish local misconfiguration from remote SSO drift
  before spending time on browser runs.

### OPZ-08: Provide a Local UI E2E Session Fixture for MODE_USER_ID

Status: Open from 2026-06-30 rerun.

Observed:

- `MODE_USER_ID` lets the API accept protected Loops requests through Turbo.
- The Web app still has no matching local session fixture, so `/loops/new`
  redirects to login when real SSO is blocked.
- Controlled issue/runtime validation had to use direct API calls.

Next execution plan:

- 目标: Allow local browser UI QA to exercise Loops screens without external
  SSO when the API is deliberately running in dev bypass mode.
- 范围: Add a Playwright-only or dev-only session fixture that mirrors the
  frontend token/session shape and can set `currentTenantSnapshot` for
  `优惠豚`; document the command and ensure it is disabled outside local/test.
- 不做: Do not change production auth, do not make bypass available in deployed
  builds, and do not treat this as replacing real SSO E2E.
- 受益: UI regressions in issue intake and agent runtime can be tested even when
  SSO integration is unavailable, while real SSO remains a separate gate.
