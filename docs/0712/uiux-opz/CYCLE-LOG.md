# UI/UX Follow-up Implementation Cycle Log

Date: 2026-07-12

This log records the requested implementation sequence. A cycle is marked
complete only after its focused validation has passed and its remaining work
has been reviewed.

## Cycle 1 - OIDC Scope Configuration

Status: completed

**Implementation:**

- Added `SSO_SCOPES` resolution to the API OIDC URL/config resolver.
- Preserved the existing default scopes when no value is supplied.
- Rejected scope sets without `openid`, duplicate scopes, and invalid tokens.
- Replaced the OIDC service's hard-coded authorization scope string.

**Validation:**

- `pnpm --filter @repo/api test -- url-resolver.spec.ts` passed (9 tests).
- `pnpm --filter @repo/api type-check` passed.

**Docs:** Created the initial UI/UX review and recorded the scope-policy
dependency before starting the browser-flow fixes.

Review of remaining items:

- The real browser flow may now reach a terminal OAuth error page, but its E2E
  polling currently classifies every `/auth/oidc/*` URL as pending. This can
  hide both success and provider failures. Proceed to Cycle 2.
- Allowlisting the required scopes at `sso.ixicai.cn` remains an external
  configuration dependency and is tracked as DEP-01 in the review.

Next execution plan:

- 目标: Make the real-browser SSO test distinguish an active callback from a
  terminal success or OAuth-error page.
- 范围: Change only E2E navigation classification and its focused tests; keep
  the existing login, token, refresh, upload, and logout assertions.
- 不做: Do not bypass the SSO flow, suppress OAuth errors, or claim a real
  tenant login succeeded while the client scope policy rejects it.
- 受益: Failures become immediate and diagnosable instead of appearing as a
  generic 45-second loading timeout.

## Cycle 2 - Terminal SSO Navigation Recognition

Status: completed

**Implementation:**

- Added a shared E2E navigation classifier.
- Restricted the pending state to the two callback routes only, including
  localized variants.
- Treated `/auth/oidc/success`, including an `invalid_scope` result, as a
  terminal page.
- Added an explicit OAuth-error assertion before the test checks browser
  tokens.

**Validation:**

- `pnpm --filter @repo/web exec vitest run __tests__/sso-e2e-env.test.ts`
  passed (24 tests).

**Docs:** Marked terminal SSO navigation recognition complete and recorded the
component-level OAuth error presentation gap.

Review of remaining items:

- The application success page already contains an error branch, but it lacks
  a focused component regression that proves the provider error is visible and
  the loading state is absent. Proceed to Cycle 3.

Next execution plan:

- 目标: Prove that an OAuth `invalid_scope` result renders a localized recoverable
  error instead of the sign-in completion spinner.
- 范围: Add a component-level success-page regression with mocked URL query
  parameters and assert the retry destination; preserve the existing token
  exchange path.
- 不做: Do not render provider descriptions that contain secrets or introduce
  a second client-side token exchange path.
- 受益: The product-level error state remains protected even if E2E polling or
  callback route implementation changes later.

## Cycle 3 - OAuth Failure Presentation

Status: completed

**Implementation:**

- Added a success-page component regression for `invalid_scope`.
- Replaced the raw SSO `error_description` presentation with the localized
  generic retry explanation.
- Kept the existing error routing and retry link; an OAuth error does not start
  a token exchange and does not render the completion spinner.

**Validation:**

- `pnpm --filter @repo/web exec vitest run
'app/[locale]/auth/oidc/success/page.test.tsx' __tests__/sso-e2e-env.test.ts`
  passed (25 tests).
- `pnpm --filter @repo/web type-check` passed.

**Docs:** Marked the safe OAuth failure UI complete and documented the pending
Runtime deep-link repair.

Review of remaining items:

- The documented `/loops/agent-runtime` deep link is still captured by the
  dynamic `[issueId]` page and can lead to an issue lookup for
  `agent-runtime`. Add an explicit route in Cycle 4.
- Full real SSO tenant verification remains blocked only by the external scope
  allowlist in DEP-01; it must not be marked passed before that dependency is
  resolved.

Next execution plan:

- 目标: Make the documented Agent Runtime URL reliably reach the runtime panel.
- 范围: Add a static `/loops/agent-runtime` route that redirects to the
  dashboard runtime anchor and cover the route contract with a focused test.
- 不做: Do not duplicate runtime data loading, change issue-detail behavior,
  or introduce a new runtime state model.
- 受益: Bookmarks and operator links no longer resolve as a nonexistent issue
  and the dashboard remains the single runtime surface.

## Cycle 4 - Agent Runtime Deep Link

Status: completed

**Implementation:**

- Added an explicit static `/loops/agent-runtime` route.
- Redirected it to `/loops#agent-runtime`, the existing dashboard panel.
- Added a route contract test for the redirect target.

**Validation:**

- `pnpm --filter @repo/web exec vitest run
app/loops/agent-runtime/page.test.tsx` passed (1 test).
- `pnpm --filter @repo/web type-check` passed.

**Docs:** Marked the static Runtime route complete and recorded the remaining
documentation guardrail work.

Review of remaining items:

- The UI/UX review documents now contain completed, external-blocked, and
  pending states, but no automated check prevents a future plan from omitting
  the required 目标/范围/不做/受益 fields. Proceed to Cycle 5.
- There are no remaining repository-owned UX implementation items from this
  review after that validation is added. DEP-01 will remain external-blocked
  until `sso.ixicai.cn` changes the client allowlist and real E2E is rerun.

Next execution plan:

- 目标: Validate every UI/UX follow-up plan has the required execution fields
  and complete an integrated API/Web verification pass.
- 范围: Extend the existing documentation-plan checker to include `docs/0712`,
  add focused checker tests, run affected API/Web tests and the quality gate.
- 不做: Do not rewrite historical findings, mark the external SSO policy as
  solved, or mask unrelated pre-existing test failures.
- 受益: Future implementation work remains executable and the handoff states
  are mechanically verifiable.

## Cycle 5 - Documentation Guardrail And Integrated Verification

Status: completed

**Implementation:**

- Extended the existing execution-plan checker to scan both `docs/0629` and
  `docs/0712`.
- Added a regression proving the UI/UX review directory is included.
- Recorded the final repository-owned and external-dependency states.

**Validation:**

- `node --test scripts/check-docs0629-next-plans.test.js` passed (4 tests).
- `pnpm check:docs0629-next-plans` passed.
- `pnpm quality:gate` passed, including architecture, SSO boundaries,
  sensitive-log scan, documentation checks, and API/Web type-checks.
- `pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx` passed
  (6 tests). This isolated recheck did not reproduce the earlier timeout from
  a broad, incorrectly forwarded Vitest invocation.

**Docs:** Added the 0712 next-plan validation status and isolated the external
SSO allowlist as the only remaining acceptance dependency at that point.

Final review:

- All repository-owned follow-up implementation items found in the 0712 UI/UX
  review are complete: scope configuration, terminal E2E classification,
  safe OAuth failure presentation, runtime deep link, and documentation
  validation.
- DEP-01 remains external-blocked. No real login for `优惠豚`, issue submission,
  or agent runtime test may be marked passed until `sso.ixicai.cn` allowlists
  the approved `SSO_SCOPES` and the real browser test succeeds.

Next execution plan:

- 目标: Complete the final real-SSO verification for the requested `优惠豚`
  tenant after the OAuth client policy changes.
- 范围: Have `sso.ixicai.cn` allowlist the approved scope set, deploy that
  environment value, run the real browser flow, and verify tenant context,
  issue submission, Continue Loop, and Agent Runtime.
- 不做: Do not change application authorization behavior, disable scope
  validation, or represent an external configuration change as a code fix.
- 受益: The remaining uncertainty is reduced to a single auditable external
  change and an end-to-end acceptance result.

## Cycle 6 - Tenant Scope Invariant

Status: completed

**Implementation:** Required both `openid` and `tenant` in `SSO_SCOPES`; the
refresh scope remains client-policy dependent.

**Validation:** `pnpm --filter @repo/api test -- url-resolver.spec.ts` passed
(10 tests), and `pnpm --filter @repo/api type-check` passed.

**Docs:** Updated the sample configuration and this review log to state the
tenant-scope invariant.

Review of remaining items:

- The Runtime deep-link redirect points to `#agent-runtime`, but the dashboard
  only exposes `agent-runtime-title`. The redirect therefore reaches `/loops`
  without focusing the runtime panel. Proceed to Cycle 7.

Next execution plan:

- 目标: Make the Agent Runtime deep link target a real dashboard anchor.
- 范围: Add the anchor to the existing runtime section and add a focused DOM
  regression alongside the existing redirect test.
- 不做: Do not change runtime fetching, duplicate the dashboard, or alter
  issue-detail URLs.
- 受益: Operators who use `/loops/agent-runtime` arrive at the intended runtime
  panel rather than the top of the dashboard.

## Cycle 7 - Agent Runtime Anchor

Status: completed

**Implementation:** Added `id="agent-runtime"` to the existing dashboard
runtime section so `/loops/agent-runtime` resolves to an actual anchor.

**Validation:** `pnpm --filter @repo/web exec vitest run
app/loops/page.test.tsx app/loops/agent-runtime/page.test.tsx` passed (8 tests),
and `pnpm --filter @repo/web type-check` passed.

**Docs:** Updated the UI/UX review status to distinguish the fixed redirect and
anchor behavior from the still external real-SSO dependency.

Review of remaining items:

- The callback controller safely redirects provider errors to the frontend, but
  logs the raw provider `error_description`. That contradicts the safe UI
  presentation policy and may record unnecessary third-party text. Proceed to
  Cycle 8.

Next execution plan:

- 目标: Keep OAuth callback diagnostics useful without logging raw provider
  descriptions.
- 范围: Log the stable OAuth error code and a boolean indicating whether a
  provider description exists; add controller coverage for the error redirect.
- 不做: Do not alter redirect query propagation, hide the OAuth error code, or
  weaken server-side troubleshooting signals.
- 受益: Production logs remain safe while operators can still distinguish a
  provider rejection from a missing callback parameter.

## Cycle 8 - OAuth Callback Log Redaction

Status: completed

**Implementation:** Replaced the raw provider `error_description` in callback
logs with `hasErrorDescription`, while preserving the redirect query for the
frontend's safe localized error state.

**Validation:** `pnpm --filter @repo/api test --
oidc-client-api.controller.spec.ts url-resolver.spec.ts` passed (11 tests),
`pnpm --filter @repo/api type-check` passed, and `pnpm check:sensitive-logs`
passed.

**Docs:** Recorded the logging boundary and its focused controller regression.

Review of remaining items:

- The generic documentation checker verifies the four execution-plan fields,
  but `docs/0712/uiux-opz/CYCLE-LOG.md` is not checked for its implementation,
  validation, and documentation markers. Proceed to Cycle 9.

Next execution plan:

- 目标: Mechanically validate each 0712 implementation cycle's evidence fields.
- 范围: Extend the existing implementation-cycle checker to scan this cycle
  log and accept its explicit `**Implementation:**`, `**Validation:**`, and
  `**Docs:**` markers; add unit coverage for missing markers.
- 不做: Do not change historical implementation outcomes or loosen the
  required execution-plan validation.
- 受益: A future documentation edit cannot silently remove the evidence that
  makes a completed cycle auditable.

## Cycle 9 - 0712 Cycle-Evidence Guardrail

Status: completed

**Implementation:** Extended the existing implementation-cycle checker to scan
`docs/0712/uiux-opz/CYCLE-LOG.md` as well as the legacy 0629 annotations.

**Validation:** `node --test scripts/check-docs0629-implementation-cycles.test.js`
passed (4 tests), and `pnpm check:docs0629-implementation-cycles` passed.

**Docs:** Normalized Cycles 1 through 5 with explicit Implementation,
Validation, and Docs markers so all nine recorded cycles are auditable.

Review of remaining items:

- Repository-owned findings from this second review are implemented. The final
  task is to run the full quality gate and ensure the review and next-step
  documents distinguish completed code from the external `sso.ixicai.cn`
  allowlist dependency. Proceed to Cycle 10.

Next execution plan:

- 目标: Verify the complete second-review change set and publish an accurate
  final implementation state.
- 范围: Run the quality gate, focused API/Web regressions, plan/cycle document
  checks, and a diff whitespace audit; update final status and external-only
  next steps.
- 不做: Do not run a credentialed real SSO acceptance test before the client
  scope policy changes, or claim that the external condition has passed.
- 受益: The handoff separates verified repository behavior from the one
  remaining external acceptance dependency.

## Cycle 10 - Second Review Final Verification

Status: completed

**Implementation:** Completed the second deep-review follow-ups: tenant scope
invariant, Runtime anchor, callback-log redaction, and 0712 cycle-evidence
guardrail.

**Validation:** API focused tests passed (11 tests); Web focused tests passed
(33 tests); both documentation checks and `git diff --check` passed; and
`pnpm quality:gate` passed.

**Docs:** Updated the review, this cycle log, and next-step status to make the
external `sso.ixicai.cn` scope allowlist the only remaining acceptance item.

Final review:

- All repository-owned findings from the second review are complete and
  machine-checked.
- Real acceptance for account `13800138000` and tenant `优惠豚` remains
  external-blocked until `sso.ixicai.cn` allows the configured scope set,
  including mandatory `openid` and `tenant`, and the real browser flow is
  rerun successfully.

Next execution plan:

- 目标: Complete the remaining production-like SSO acceptance after
  `sso.ixicai.cn` approves the OAuth client scope set.
- 范围: Apply the approved `SSO_SCOPES`, run the real browser test, and verify
  login, `优惠豚` tenant context, issue creation, Continue Loop, and Agent
  Runtime deep link.
- 不做: Do not use bypass authentication as acceptance evidence, remove the
  mandatory tenant scope, or treat preflight success as user-login success.
- 受益: Produces the final end-to-end proof while preserving tenant governance
  and the validated security boundaries.

## Cycle 11 - Real Account E2E Retest

Status: partially completed - external scope policy blocks downstream workflow

**Implementation:** Preserved the initial callback OAuth error through URL
cleanup, removed its locale-link hydration mismatch, and made the real E2E
test distinguish terminal authorization errors from exchange failures.

**Validation:** Real browser login with the requested account reached
`sso.ixicai.cn`, which returned `invalid_scope`; no authorization code or token
exchange was issued. The browser screenshot verified a localized retry state
rather than the completion spinner. Focused Web tests passed (26 tests), as
did Web type-check and the documentation checks.

**Docs:** Added the real-run UI/UX evidence, BUG-01, and OPZ-01 under
`docs/0712`.

Review of remaining items:

- BUG-01 blocks the required tenant session, so `优惠豚`, real Issue submission,
  Continue Loop, and Agent Runtime remain untested for this account.

Next execution plan:

- 目标: Complete the real-account workflow after the OAuth scope policy is
  corrected.
- 范围: Allowlist the configured scopes in `sso.ixicai.cn`, then rerun login,
  tenant context, Issue, Continue Loop, and Agent Runtime checks.
- 不做: Do not record the controlled bypass flow as real-account acceptance or
  weaken tenant scope validation.
- 受益: Closes the remaining end-to-end acceptance gap with reproducible
  browser evidence.
