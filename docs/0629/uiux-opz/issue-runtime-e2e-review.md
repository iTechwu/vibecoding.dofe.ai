# Issue Submit and Agent Runtime UI/UX Review

Date: 2026-06-29

## Test Scope

- Account requested: `13800138000`
- Tenant requested: `优惠豚`
- Entry points tested:
  - `/loops/new`
  - `/loops/issue-20260629-a55aca10`
  - `Continue Loop`
  - runtime status shown from `/loops/agent-runtime`

## Result Summary

The real SSO path could not reach the login form because the generated OAuth
authorize URL used a redirect URI rejected by the SSO provider. After switching
to a controlled local auth bypass, the issue submission and runtime UI path did
work:

- A test issue was created: `issue-20260629-a55aca10`.
- The issue detail page opened successfully.
- `Continue Loop` generated `spec.v1` and moved the issue to `PHASE_2_REVIEW`.
- Runtime detection reported Codex and Claude Code local CLI as ready.

Screenshots were captured under `test-results/`:

- `0629-login-start.png`
- `0629-loops-new-before.png`
- `0629-loops-new-filled.png`
- `0629-loop-detail-after-create.png`
- `0629-loop-detail-after-continue.png`

Final follow-up validation:

- Issue detail now has regression coverage for visible tenant context (`优惠豚`)
  and human-gated runtime copy.
- `GET /favicon.ico` on the local Next dev server now returns `308` to
  `/logo.svg`, removing the observed 404 resource noise.
- Remaining console-noise classification depends on a real browser SSO run; the
  repository now has a no-browser SSO env preflight
  (`node apps/web/scripts/verify-sso-e2e-env.mjs`) that should be run first.
- Cycle 91 completed real browser credential entry for account `13800138000`,
  but the browser landed on an SSO API 404 callback page before returning to
  vibecoding. No password or trace artifact is retained in this repository.
- 2026-06-30 rerun did not reach credential entry. The browser landed on a raw
  SSO API JSON error page for `redirect_uri not allowed` before the login form.
  Controlled API validation still proved that a `优惠豚` issue can be created,
  tenant context is persisted, `Continue Loop` generates `spec v1`, and runtime
  readiness is available.

## UX Findings

### UX-01: Tenant Context Is Not Visible in the Loop UI

Status: Implemented in Cycle 2 for issue detail intake visibility, Cycle 6 for
pre-submit tenant confirmation, and Cycle 11 for readable tenant name/team
snapshot display on both simple and full `/loops/new` forms. Cycle 23 hardens
the browser tenant snapshot parser so malformed local storage falls back safely
instead of showing or submitting invalid tenant context. Cycle 28 verifies that
tenant cleanup clears both legacy id and readable snapshot state. Cycle 33
verifies tenant snapshot updates dispatch the browser event used by `/loops/new`
to refresh visible tenant context. Cycle 37 adds direct `useCurrentLoopTenant`
coverage for same-tab and cross-tab tenant refresh behavior. Cycle 41 adds
same-tab tenant clear coverage so logout/tenant reset removes stale visible
tenant context without a page reload. Cycle 50 normalizes the legacy `currentTenant` fallback in `getCurrentTenantSnapshot` so a whitespace-only or padded legacy tenant id is trimmed/rejected consistently with the readable snapshot path. Cycle 58 extends that parity to the `setCurrentTenantId` setter, which now trims and rejects empty/whitespace ids before persisting. Real browser validation should now start with
the plain-Node SSO env preflight before credential entry.

Observed:

- The requested tenant was `优惠豚`.
- The detail page showed submitter as a user id and workspace as `default`.
- No visible tenant selector, tenant badge, or tenant confirmation was present
  on the issue creation or detail screens.

Impact:

- Operators cannot confirm whether they are creating or running a loop under
  the intended tenant.
- Cross-tenant evidence, archives, and runtime permissions become hard to audit
  from the UI.

Next execution plan:

- 目标: Validate tenant confirmation with real SSO.
- 范围: Run `node apps/web/scripts/verify-sso-e2e-env.mjs`, then log in as
  `13800138000`, select `优惠豚`, and confirm `/loops/new` shows the readable tenant name plus
  tenant/team audit identifiers before submission; confirm issue detail shows
  the same persisted tenant context; keep malformed local tenant snapshot,
  same-tab tenant update, cross-tab tenant update, and tenant-clear regression
  coverage in the Web suite.
- 不做: Do not build tenant switching or membership editing in this pass.
- 受益: Operators can verify they are working inside `优惠豚` before spending
  runtime or approving delivery evidence.

### UX-02: Runtime Panel Says "Inferred" or "Not Reported" for Human Gate

Status: Implemented in Cycle 3. Human-owned phases now show an explicit
awaiting-human-review state instead of presenting runtime mode as missing.
Cycle 24 adds focused Chinese-locale regression coverage for the same
human-gate copy.

Observed:

- Before continuing, the issue detail showed runtime as `Local Cli default` but
  also said the runtime was inferred.
- After continuing, current actor became `Human`; runtime mode changed to
  `未上报`, while the page still presented runtime status in the same block.

Impact:

- The user cannot tell whether runtime is unavailable, unnecessary because the
  current actor is human, or simply unmatched.

Next execution plan:

- 目标: Verify human-gate copy in browser E2E.
- 范围: Re-run the issue-detail flow in `PHASE_2_REVIEW` and confirm the runtime
  panel reads as human-gated in Chinese and English locales; repository tests
  now cover both locales.
- 不做: Do not change scheduler phase semantics or runtime selection logic.
- 受益: Users understand why `Continue Loop` stops and what they must do next.

### UX-03: The Detail Page Is Dense After First Create

Observed:

- Immediately after creating an issue, the page previously exposed many controls:
  Browser QA, second opinion, canary, runtime override, governance gates,
  delivery evidence, artifacts, logs, and checkpoints.
- The primary next step is present but visually competes with secondary
  controls.

Current implementation:

- Early `PHASE_1_SPEC` issue details now collapse advanced delivery controls
  when there are no shards, implementation records, review records, test
  records, Browser QA reports, global review, or second-opinion evidence.
- Issues with active delivery evidence keep the existing expanded operator view.
- Cycle 19 adds an explicit regression for the evidence-bearing issue detail
  state, covering direct visibility of Browser QA, second opinion, and canary
  actions.

Impact:

- New users can miss the intended product-level action: generate/review spec,
  then continue the loop.

Next execution plan:

- 目标: Verify first-run readability in browser E2E.
- 范围: Create a fresh issue and confirm advanced delivery controls are collapsed
  until the issue has delivery evidence; confirm existing in-progress issues keep
  operator controls expanded.
- 不做: Do not remove existing diagnostics, audit evidence, or advanced controls.
- 受益: Users move through issue creation and runtime progression with less
  cognitive load while operators still retain full evidence access.

### UX-04: Console Noise During Navigation Makes Browser QA Harder

Status: Implemented for the repository-owned resource and Browser QA
classification paths. The concrete default favicon 404 now redirects to the
existing logo asset, and Browser QA now classifies expected navigation/request
cancellations as ignored evidence instead of failures.

Observed:

- Browser console reported multiple aborted requests when navigating between
  loop pages.
- A Next.js preload warning appeared for a static CSS chunk.
- A 404 resource error appeared during page loads.

Current implementation:

- `/favicon.ico` redirects to `/logo.svg`, removing the default missing resource
  failure.
- Browser QA listens for `requestfailed` events and classifies
  `ERR_ABORTED`, `AbortError`, `NS_BINDING_ABORTED`, `cancelled`, and `canceled`
  as `navigation-cancelled` ignored network failures.
- Ignored navigation cancellations are included in Browser QA reports and
  surfaced in the issue detail QA artifact summary.
- Cycle 12 also includes ignored navigation-cancel counts in the Browser QA
  evidence artifact summary so audit reviewers can distinguish ignored noise
  from true `consoleErrors` / `networkFailures`.
- Cycle 29 adds direct helper coverage for common browser cancellation strings
  and confirms real connection/name failures remain strict failures.
- Cycle 34 makes the embedded worker script derive its cancellation matcher from
  the same helper pattern source to reduce future drift.
- Cycle 39 validates required worker-output arrays before report mapping, so a
  malformed Browser QA worker result becomes a readable blocked report instead
  of a generic TypeError.
- Cycle 43 wraps malformed JSON output in the same readable blocked report
  family, avoiding raw parser syntax errors in operator-facing diagnostics.
- Cycle 49 adds direct regression coverage for the worker crash → `blocked`
  path, so a worker process that exits non-zero or times out surfaces a readable
  reason instead of propagating an unhandled exception.
- Cycle 56 adds coverage for the disallowed-target-repo → `blocked` path, which
  fires before the worker spawns when `resolveAllowedTargetRepo` rejects.

Impact:

- Browser QA and operator diagnosis have to separate real product failures from
  expected navigation cancellation noise.

Next execution plan:

- 目标: Confirm runtime console noise classification in browser E2E.
- 范围: Run Browser QA against `/loops` and `/loops/:issueId`, verify
  `networkFailures` only includes real HTTP failures and
  `ignoredNetworkFailures` contains expected navigation cancellations.
- 不做: Do not suppress genuine 4xx/5xx responses, hydration errors, or visual
  regressions.
- 受益: QA reports remain strict for product failures while avoiding false
  negatives from normal route transitions.

### UX-05: Failed SSO Callback Exposes a Raw JSON Error Page

Observed:

- After successful mobile credential submission in the real browser SSO test,
  the final browser page showed raw JSON:
  `{"code":404,"msg":"Cannot GET /auth/oidc/callback?..."}`
- The page was hosted by the SSO API origin, not by vibecoding's localized
  `/auth/oidc/success` error UI.
- On 2026-06-30 the browser failed even earlier on the SSO authorize endpoint
  with raw JSON:
  `{"error":"invalid_request","error_description":"redirect_uri not allowed"}`.
- Playwright then reported `Unable to find visible mobile field on SSO login
page`, which is technically true but hides the real user-facing state: there
  was no login page, only a raw OAuth error payload.

Impact:

- Users and QA operators see a technical 404 payload instead of a recoverable
  sign-in error.
- It is hard to tell whether the account, tenant, callback registration, or
  browser trust setup failed.

Next execution plan:

- 目标: Make callback failures actionable to operators.
- 范围: After BUG-06/BUG-07 are fixed, rerun the real browser SSO flow and
  confirm authorize/callback errors either return to vibecoding's localized
  success/error page or SSO renders a user-facing OAuth error with client id,
  requested callback, and trace id; add the observed trace id to server logs,
  not browser-visible secrets. Update Playwright assertions so an OAuth JSON
  error is reported as the primary failure before field selectors run.
- 不做: Do not expose authorization codes, tokens, cookies, or submitted
  credentials in UI errors.
- 受益: QA can distinguish callback registration/configuration failures from
  account or tenant failures without inspecting raw traces.

### UX-06: Local Auth Bypass Does Not Give the Web App a Test Login State

Observed:

- Starting API with `MODE_USER_ID=11111111-1111-4111-8111-111111111111`
  allowed protected Loops API calls.
- Opening `/loops/new` in the browser still followed the frontend login gate,
  so setting a local tenant snapshot for `优惠豚` was not enough to exercise the
  form through UI.
- The issue/runtime product path had to be verified through direct API calls
  instead of a complete local UI smoke.

Impact:

- Local QA can verify service behavior but cannot easily verify issue intake UI
  when remote SSO is unavailable.
- Reproducing UX issues requires either a real SSO fix or ad hoc browser state
  setup that is easy to drift.

Next execution plan:

- 目标: Provide a safe local-only browser login fixture for Loops UI QA.
- 范围: Add a dev/test-only helper or Playwright fixture that creates the same
  frontend session shape the app expects while API runs with `MODE_USER_ID`;
  keep it disabled outside local/test and document that it is not a substitute
  for real SSO validation.
- 不做: Do not bypass production SSO, do not store real credentials, and do not
  change the user-facing login flow.
- 受益: QA can complete issue submission and agent runtime UI checks even when
  external SSO is down or misconfigured, while still preserving separate real
  SSO coverage.
