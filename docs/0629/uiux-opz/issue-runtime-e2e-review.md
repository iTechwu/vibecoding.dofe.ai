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
- Remaining console-noise classification depends on a real browser SSO run after
  external callback/env alignment.

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
coverage for same-tab and cross-tab tenant refresh behavior. Real browser
validation still depends on SSO callback/env alignment.

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
- 范围: After SSO callback/env alignment, log in as `13800138000`, select
  `优惠豚`, and confirm `/loops/new` shows the readable tenant name plus
  tenant/team audit identifiers before submission; confirm issue detail shows
  the same persisted tenant context; keep malformed local tenant snapshot
  regression coverage in the Web suite.
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
