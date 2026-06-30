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
  during the final API smoke run and remain upstream `@dofe/infra-rabbitmq`
  work.

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

- 目标: Verify Docker fallback preparation against a real Docker daemon and
  registry.
- 范围: Run the dashboard action or `POST /loops/workspaces/:workspaceId/pull-image`
  for Codex and Claude Code, then confirm `/loops/agent-runtime` reports the
  selected Docker candidate as ready; repository tests now cover the local
  already-present, initial-inspect-error, pulled, post-pull-not-ready,
  post-pull-inspect-error, dashboard business-failure, and dashboard
  request-error branches.
- 不做: Do not change pinned image digests or registry credential storage in this
  pass.
- 受益: Runtime fallback is usable when local CLI is unavailable, improving
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

Next execution plan:

- 目标: Verify local/test SSO configuration against the SSO client registration.
- 范围: Run with the documented env overrides and confirm the SSO OAuth client
  allows `http://127.0.0.1:13100/auth/oidc/callback`; use
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
bypass winston; the dependency bump remains external. Cycle 57 locks the
redaction depth-cap / non-crash contract with regressions for circular
references and deeply nested meta, so the defense layer cannot regress into a
stack overflow. Cycle 63 lands the upstream root-cause fix in
`infra.dofe.ai/packages/rabbitmq`: `redactUrlCredentials` / `redactErrorMessage`
are applied at the events-module connect log, the events-module connection-error
log, and the service init/connection error logs, with a `node --test` smoke
test. After a version bump this supersedes the app-layer redaction for the
RabbitMQ winston path.

Observed:

- Startup logs print full RabbitMQ connection URLs.
- Local env also contains registry and SSO secrets, so routine logs should avoid
  normalizing secret-bearing patterns.

Next execution plan:

- 目标: Prevent accidental credential exposure in local and CI logs.
- 范围: Update `@dofe/infra-rabbitmq` to mask credentials in connection URLs
  before logging, then bump the dependency in this repo.
- 不做: Do not remove useful host/service diagnostics.
- 受益: Logs remain useful while reducing leakage risk during QA, screenshots,
  or issue reports.

### OPZ-04: Normalize Optional RabbitMQ Shutdown Logging

Status: Root-cause fix landed upstream in Cycle 64 (`infra.dofe.ai/packages/rabbitmq`).
The service close handler now downgrades the "RabbitMQ connection closed" log to
`debug` when `isShuttingDown` is true (set by `onModuleDestroy`), so a benign
shutdown race no longer surfaces as `warn` alongside the graceful-close log. The
decision is extracted as `connectionClosedSeverity(isShuttingDown)` with a
`node --test` smoke test. After a version bump of `@dofe/infra-rabbitmq` this
supersedes the need for any app-level severity workaround.

Observed:

- On SIGINT, API shutdown logs `Error closing RabbitMQ connection` with
  `Connection closing`, then immediately logs graceful close.
- This happened twice during the test.

Next execution plan:

- 目标: Make optional RabbitMQ shutdown logs reflect actual severity.
- 范围: In `@dofe/infra-rabbitmq`, treat "Connection closing" during shutdown as
  debug/info when optional mode is enabled and final close succeeds, then bump
  the dependency here.
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
  no longer return false 401 responses.
- 不做: Do not enable bypass in production or preview deployments.
- 受益: Local smoke tests can exercise protected flows without confusing false
  auth failures.
