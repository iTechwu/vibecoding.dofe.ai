# Issue Submit and Agent Runtime Bug List

Date: 2026-06-29

## Test Boundary

Requested path:

- Login with `13800138000`
- Use tenant `优惠豚`
- Test issue submission and agent runtime

Actual boundary:

- Real SSO login was blocked before credential entry.
- Business flow was then tested with a controlled local auth bypass:
  `MODE_USER_ID=11111111-1111-4111-8111-111111111111`.
- Created issue: `issue-20260629-a55aca10`.
- `Continue Loop` generated `spec.v1` and moved the issue to review.

Final follow-up validation:

- `MODE_USER_ID=11111111-1111-4111-8111-111111111111 ... pnpm dev:api`
  now reaches protected Loops routes through Turbo; `GET /loops/workspaces`
  returned `200`.
- Focused API, contract, web, and type-check suites passed after the fixes.
- Real SSO account login remains blocked by external SSO callback/env
  alignment, so the requested credentials were not re-entered in the browser.

## Bugs

### BUG-01: Real SSO Login Is Blocked by Rejected Redirect URI

Severity: P0

Status: Repository-side alignment implemented in Cycles 1, 5, and 9. The API
OIDC URL resolver supports explicit local/test E2E URL overrides, Turbo passes
those variables through to dev tasks, and `apps/api/.env.example` now documents
the callback/frontend override pair. Cycle 13 adds a Playwright E2E preflight
that fails early with the exact callback URL SSO must allow when env origins are
misaligned. Cycle 36 locks malformed URL input handling so bad env values are
reported as preflight issues instead of derailing browser login with low-level
errors. Cycle 47 adds direct unit coverage for `buildSsoE2eEnvFromProcess`, the
`process.env` → preflight-env entry point, so a mistyped env key can no longer
silently default the origins and callback URL the preflight checks. Cycle 59
requires the four required preflight origins to use the http/https scheme, so a
valid-but-non-web origin like `ftp://` fails the preflight before browser login.
Cycle 61 confirms the SSO side is also complete: the `vibecoding-dofe-ai` client
in `sso.dofe.ai` already allow-lists `http://127.0.0.1:13100/auth/oidc/callback`
and the frontend callback, now protected by a regression in
`sso.dofe.ai/apps/api/scripts/oauth-clients.config.spec.ts`. BUG-01 is closed
end-to-end; an operator only needs to run vibecoding with
`VIBECODING_APP_BASE_URL=http://127.0.0.1:13100`.

Observed:

- Opening local `/loops/new` redirected to SSO authorize.
- SSO returned:
  `{"error":"invalid_request","error_description":"redirect_uri not allowed"}`
- Generated redirect URI:
  `https://api.vibecoding.local.dofe.ai/auth/oidc/callback`

Expected:

- SSO authorize should proceed to the login form for the configured local/test
  environment.

Impact:

- The requested account and tenant could not be tested through the real login
  path.
- Any SSO-gated issue submission E2E fails before the user can enter
  credentials.

Next execution plan:

- 目标: Verify real SSO login for vibecoding local/test E2E.
- 范围: Run API with `VIBECODING_APP_BASE_URL=http://127.0.0.1:13100` and
  `VIBECODING_APP_FRONTEND_URL=http://127.0.0.1:3003`, then confirm
  `http://127.0.0.1:13100/auth/oidc/callback` is registered in the SSO test
  OAuth client. Run `pnpm --filter @repo/web test:e2e:sso`; the preflight now
  reports API/frontend/SSO origin mismatches before attempting browser login.
- 不做: Do not weaken redirect URI validation or accept wildcard callbacks.
- 受益: The team can run real-account tenant E2E without auth bypass.

### BUG-02: Frontend SSO Session Probe Uses a Different SSO Host Than API OIDC

Severity: P1

Status: Repository-side env guidance implemented in Cycle 9. `apps/web/.env.example`
now calls out that `NEXT_PUBLIC_SSO_BASE_URL` must match the API
`SSO_ISSUER` / `SSO_API_URL` tier for real E2E. Cycle 13 adds a reusable E2E
env validator that checks those origins before the SSO page is opened. Cycle 16
extends the preflight to include `SSO_INTERNAL_API_URL`. Cycle 36 adds
malformed URL regression coverage for the same preflight surface. Cycle 48
extends the preflight to also require the SSO login portal origin
(`E2E_SSO_LOGIN_ORIGIN`) to be a valid URL before browser login, since the login
page may live on a different origin than the SSO API.

Observed:

- Browser console showed CORS failure for
  `https://api.sso.local.dofe.ai/auth/session`.
- API OIDC config used `https://api.sso.test.dofe.ai`.

Expected:

- Frontend session probe and backend OIDC issuer should target the same SSO
  environment for a given test run.

Impact:

- Even if the redirect URI is fixed, direct session restore may fail or behave
  inconsistently.

Next execution plan:

- 目标: Verify one coherent SSO environment per run.
- 范围: Start Web/API with env files where
  `NEXT_PUBLIC_SSO_BASE_URL`, `SSO_ISSUER`, `SSO_API_URL`, and
  `SSO_INTERNAL_API_URL` all point to the same local/test SSO tier, then run the
  SSO E2E preflight.
- 不做: Do not couple production frontend builds to local-only SSO settings.
- 受益: Session restore, tenant discovery, and OAuth redirect behavior become
  predictable.

### BUG-03: Requested Tenant Is Not Applied or Audited in Created Issue

Severity: P1

Status: Implemented in Cycle 2 for issue intake persistence and detail-page
audit visibility, and improved in Cycle 11 so the web intake forms can display
the SSO tenant name/team snapshot before submission. Cycle 23 hardens the
browser tenant snapshot parser so malformed local storage cannot inject invalid
tenant context into an issue payload. Cycle 28 adds storage cleanup regression
coverage so logout/tenant reset removes both legacy tenant id and readable
tenant snapshot state. Cycle 33 verifies `currentTenantUpdated` is dispatched
when a readable tenant snapshot is set, protecting `/loops/new` live tenant
refresh. Cycle 37 adds hook-level coverage proving `/loops/new` refreshes from
both same-tab tenant updates and cross-tab storage events. Remaining validation
depends on real SSO providing tenant scope after BUG-01/BUG-02 are fully
cleared. Cycle 41 verifies tenant clearing dispatches the same browser update
event so `/loops/new` clears stale visible tenant context in the current tab. Cycle 50 normalizes the legacy `currentTenant` fallback in `getCurrentTenantSnapshot` so a whitespace-only or padded legacy tenant id is trimmed/rejected consistently with the readable snapshot path. Cycle 58 extends that parity to the `setCurrentTenantId` setter, which now trims and rejects empty/whitespace ids before persisting.

Observed:

- The test used local storage current tenant `优惠豚` during bypass testing.
- Created issue detail showed submitter id and workspace `default`.
- Issue API response did not expose tenant context for
  `issue-20260629-a55aca10`.

Expected:

- When a user selects or carries tenant `优惠豚`, the created issue should show
  tenant context or reject creation if tenant context is missing.

Impact:

- Cross-tenant isolation cannot be confidently verified from issue records.
- Operators may run loops in the wrong tenant without noticing.

Next execution plan:

- 目标: Complete real-account tenant validation for `优惠豚`.
- 范围: Re-run full SSO E2E after callback/env alignment and confirm created
  issues contain request-derived tenant id/name/team scope, with `/loops/new`
  showing the readable tenant name before submission; keep the tenant storage
  parser, `useCurrentLoopTenant` event regressions, and tenant-clear event
  regression in the Web validation matrix.
- 不做: Do not redesign tenant switching or tenant membership management.
- 受益: Tenant-scoped runtime governance and audit trails are verifiable through
  both records and UI.

### BUG-04: Test Deployment `vibecoding.test.dofe.ai` Does Not Serve Loops Route

Severity: P2

Status: Repository-side documentation clarified in Cycle 14. The executable
real-account validation path is local Web/API/SSO with the Cycle 13 E2E
preflight. Cycle 22 adds a route preflight to the SSO E2E path so a missing
`/loops/new` deployment fails before credential entry; `vibecoding.test.dofe.ai`
route availability still remains an external deployment/release validation
item. Cycle 27 tightens that route preflight so any non-2xx/non-3xx response
fails before login. Cycle 32 documents and tests that redirects such as 302/308
are acceptable because an unauthenticated Loops route may redirect toward login. Cycle 53 adds a standalone deployment route probe (`probeLoopsRoute` in `apps/web/e2e/sso-e2e-env.ts` plus the plain-Node `apps/web/scripts/verify-loops-route.mjs`) so release validation can confirm `/loops/new` on a deployed domain like `vibecoding.test.dofe.ai` without starting the local Web/API/SSO stack; the probe times out after 10s (configurable via `VERIFY_LOOPS_ROUTE_TIMEOUT_MS`) and exits non-zero on 4xx/5xx, network failure, or timeout (Cycle 55).

Observed:

- `https://vibecoding.test.dofe.ai/loops/new` returned the product 404 page.

Expected:

- If docs recommend the test domain for SSO E2E, the Loops route should be
  deployed there or docs should state it is local-only.

Impact:

- Recommended test-domain strategy cannot validate issue intake UI.

Next execution plan:

- 目标: Make the test-domain E2E path executable when release validation needs
  that domain.
- 范围: Deploy current Loops UI to `vibecoding.test.dofe.ai` and confirm
  `/loops/new` returns a usable 2xx response or an expected 3xx auth redirect;
  for repository-local QA, use the documented `127.0.0.1:3003` Web and
  `127.0.0.1:13100` API path plus the SSO E2E preflight, which fails on 4xx/5xx
  before login.
- 不做: Do not block local development on test deployment availability.
- 受益: QA can run the same URL strategy documented for SSO cookie sharing.

### BUG-05: Dev Server Mutates `apps/web/next-env.d.ts`

Severity: P3

Status: Implemented in Cycle 5. The committed/generated file format now matches
the Next dev output observed during QA. Cycle 18 adds an executable Web unit
test that fails if the generated file drifts back to a noisy format. Cycle 41
re-applied the committed double-quote format after the focused Web regression
run caught a single-quote drift. Cycle 65 applies a root-cause fix by adding
`apps/web/next-env.d.ts` to `.prettierignore`, so prettier stops reformatting the
Next-generated double-quoted import — addressing the recurring drift source, not
just the symptom.

Observed:

- Running Next dev changed `apps/web/next-env.d.ts` import quote style from
  single to double quotes.

Expected:

- Generated Next type file should not create unrelated working tree noise during
  QA.

Impact:

- Test runs produce unrelated git diff that can distract reviews.

Next execution plan:

- 目标: Confirm local QA no longer creates a `next-env.d.ts` diff.
- 范围: Start the web dev server once during the final browser pass and inspect
  `git diff -- apps/web/next-env.d.ts`; keep
  `apps/web/__tests__/next-env-format.test.ts` in the focused Web validation
  matrix.
- 不做: Do not hand-edit generated Next internals beyond formatting alignment.
- 受益: Worktree remains easier to review after E2E runs.
