# PM Optimization Implementation Log

Date: 2026-06-29

## Review Boundary

- Product surface: `/loops/new`, `/loops`, `/loops/:issueId`.
- Source context: `docs/0629/uiux-opz`, `docs/0629/buglist`,
  `docs/0629/opzs`, `docs/0623/uiux`, and the Loops web tests.
- Emphasis: product clarity, operator confidence, evidence readability, and
  user-facing next-step guidance.

## Current PM/UX Optimization Themes

1. Intake confidence: users should know whether request, workspace, tenant, and
   preview are ready before spending a loop.
2. Dashboard prioritization: operators need one obvious next action before
   scanning dense runtime, exception, and evidence panels.
3. Human gate clarity: review pauses should read as deliberate product gates,
   not runtime absence.
4. Evidence trust: delivery artifacts should explain what is available now and
   what remains unproven.
5. Implementation traceability: every optimization cycle must leave executable
   tests and dated document annotations.

## Execution Cycles

### Cycle 1: Intake Readiness Checklist

- 状态: Implemented.
- 目标: Make `/loops/new` visibly answer "can I safely create this issue now?"
  before the user clicks Create Issue.
- 范围: Add a compact readiness checklist for request, workspace, tenant, and
  generated preview; cover it in the simple intake component test and bilingual
  locale copy.
- 不做: Do not block creation when tenant context is absent, because local/dev
  and auth-bypass flows still need to submit repository-scoped issues.
- 受益: New users and operators can confirm the issue has enough context before
  runtime, budget, or review evidence is created.

### Cycle 2: Dashboard Next Action Focus

- 状态: Implemented.
- 目标: Promote the highest-value operator action above dense control-plane
  panels.
- 范围: Added `buildOperatorFocus`, prioritizing review inbox items, exception
  center items, continue actions, and create fallback; rendered the selected
  focus card immediately after the delivery guide with bilingual copy.
- 不做: Do not remove existing review inbox, exception center, or runtime panels.
- 受益: Operators can decide where to click first without reading every section.

### Cycle 3: Detail Human Gate Explanation

- 状态: Implemented.
- 目标: Make human-gated phases explain why automation stopped and what evidence
  should be reviewed next.
- 范围: Added a human gate checklist to the DRAFT spec next-action diagnostic,
  covering spec reading, approve/request-change decision, and automation resume
  after approval; covered it in issue detail tests and bilingual locale copy.
- 不做: Do not change loop phase semantics or scheduler behavior.
- 受益: Product users read pauses as deliberate approval moments instead of
  runtime failures.

### Cycle 4: Evidence Readability

- 状态: Implemented.
- 目标: Improve how artifact/evidence sections distinguish present, pending,
  and missing proof.
- 范围: Added a missing-evidence summary to the issue detail Evidence Coverage
  card, derived from existing implementation/test/review/annotation counts, with
  complete-state copy and component coverage.
- 不做: Do not invent new evidence records or alter backend evidence contracts.
- 受益: Reviewers can judge delivery confidence faster and with less guesswork.

### Cycle 5: Remaining Item Audit

- 状态: Completed.
- 目标: Re-read the implementation state after Cycles 1-4 and mark what remains
  deliberately deferred.
- 范围: Re-read the touched diff, confirmed the implementation stayed within
  Loops product/UX surfaces, and ran the focused Web validation matrix:
  `pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx app/loops/loops-dashboard-model.test.ts app/loops/page.test.tsx 'app/loops/[issueId]/page.test.tsx'`.
- 不做: Do not broaden into SSO registration, Docker registry, or upstream
  RabbitMQ fixes already tracked in adjacent 0629 docs.
- 受益: The pm-opz folder becomes an accurate handoff artifact rather than a
  stale wish list.

## Deferred / Next Optimization Items

### PM-NEXT-03: Evidence Completion State Coverage

- 状态: Implemented in Cycle 6.
- 目标: Add a positive-state test where implementation, test, review, and
  annotation evidence are all complete.
- 范围: Extended issue detail test data to cover `Evidence complete` copy and
  verify missing-evidence chips no longer render when all coverage counts are
  satisfied.
- 不做: Do not change evidence persistence or artifact contracts.
- 受益: Ensures both incomplete and complete reviewer states stay readable.

### PM-NEXT-01: Real SSO Tenant Validation

- 目标: Validate the intake readiness checklist and persisted tenant context
  with real SSO account and tenant selection.
- 范围: After SSO callback/env alignment, run the `/loops/new` flow for
  `13800138000` and tenant `优惠豚`, then confirm the readiness checklist, created
  issue, and detail audit context agree.
- 不做: Do not redesign tenant switching or membership management.
- 受益: Confirms the new PM affordance works with production-like identity
  context instead of only local storage and auth-bypass paths.

### PM-NEXT-02: Browser Visual Pass For Dense Dashboard

- 目标: Verify the operator focus card improves first-screen scanning without
  crowding existing dashboard sections.
- 范围: Run a browser screenshot pass for `/loops` at desktop and mobile widths,
  checking text wrapping, focus card placement, and anchor flow into Review
  Inbox / Exception Center.
- 不做: Do not redesign the dashboard information architecture in this pass.
- 受益: Catches layout regressions that component tests cannot see.

## Follow-up Execution Cycles

### Cycle 6: Evidence Complete Positive Coverage

- 状态: Implemented.
- 目标: Close PM-NEXT-03 by proving the positive evidence state is readable, not
  only the missing-evidence state.
- 范围: Added an issue detail test with implementation, test, review, and
  annotation evidence present; verified `Evidence complete` and
  `All required evidence is present.` render while missing chips are absent.
- 不做: Do not change evidence persistence, summarizeEvidence semantics, or
  artifact contracts.
- 受益: Reviewers can trust both sides of the evidence coverage affordance.

### Cycle 7: Operator Focus Localized Empty State

- 状态: Implemented.
- 目标: Remove hard-coded English from the operator focus create fallback so
  empty dashboards remain localized.
- 范围: Changed `buildOperatorFocus` to return an empty create fallback payload
  and moved create title/meta/action text to dashboard locale strings; updated
  the model test to lock the UI/i18n boundary.
- 不做: Do not change the focus priority order or dashboard information
  architecture.
- 受益: Chinese and future locale dashboards will not leak English when no
  review, exception, or continue action is waiting.

### Cycle 8: Intake Tenant Missing Semantics

- 状态: Implemented.
- 目标: Clarify that missing tenant context is visible audit context, not a hard
  creation blocker for local/dev and auth-bypass paths.
- 范围: Added a warning tone for the tenant readiness row when tenant context is
  absent and changed copy to explain the issue will use workspace scope; updated
  simple intake coverage and bilingual locale strings.
- 不做: Do not reject submission without tenant context and do not redesign SSO
  tenant switching.
- 受益: Operators understand the audit consequence of missing tenant context
  without being blocked from repository-scoped local validation.

### Cycle 9: Operator Focus Accessibility Boundary

- 状态: Implemented.
- 目标: Make the dashboard operator focus card a named region for assistive
  technology and more robust UI tests.
- 范围: Added `aria-labelledby` and a stable `operator-focus-title` heading id
  to the focus section; upgraded the dashboard test to query the named region
  and assert content within it.
- 不做: Do not change visual hierarchy or focus priority logic.
- 受益: Screen-reader users and tests can identify the first recommended action
  as a distinct dashboard region.

### Cycle 10: Follow-up Audit and Validation

- 状态: Completed.
- 目标: Re-check Cycles 6-9, run focused validation, and accurately mark the
  remaining implementation boundary.
- 范围: Ran the focused Web suite
  `pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx app/loops/loops-dashboard-model.test.ts app/loops/page.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  and Web type-check `pnpm --filter @repo/web type-check`; fixed strict test
  fixture typing for command and annotation records.
- 不做: Do not run real SSO browser validation or visual screenshot QA in this
  repository-only pass.
- 受益: The second implementation loop is test-backed, type-safe, and clear
  about what still depends on browser/SSO environment readiness.

## Still Deferred After Cycle 10

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Dashboard

- 目标: Verify the operator focus card and dense dashboard remain readable at
  desktop and mobile widths.
- 范围: Start the Web app and capture `/loops` screenshots for at least desktop
  and mobile viewports, checking text wrapping, first-screen hierarchy, and
  anchor flow.
- 不做: Do not redesign the dashboard layout in this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Third Follow-up Execution Cycles

### Cycle 11: Detail Primary Action Described-By Diagnostic

- 状态: Implemented.
- 目标: Make disabled or gated `Continue Loop` states explain themselves through
  the button accessibility path, not only adjacent visual text.
- 范围: Added `aria-describedby` support to the issue detail action button and
  attached the primary Continue Loop action to the next-action diagnostic panel;
  covered the DRAFT spec human-gate state in the detail test.
- 不做: Do not change button enablement, scheduler semantics, or approval flow.
- 受益: Keyboard and screen-reader users can discover why automation cannot
  continue before approving the spec.

### Cycle 12: Intake Readiness Text Status

- 状态: Implemented.
- 目标: Ensure readiness state is understandable without relying only on color.
- 范围: Added localized status labels (`Ready`, `Check`, `Pending`) to each
  readiness row and updated simple intake tests to cover warning/pending/ready
  labels as the request becomes valid.
- 不做: Do not change readiness blocking rules or tenant submission behavior.
- 受益: Users can scan intake readiness with stronger accessibility and clearer
  product semantics.

### Cycle 13: Operator Focus CTA Accessible Name

- 状态: Implemented.
- 目标: Make the operator focus CTA announce both the action and target issue so
  short labels like `Review` or `Continue` keep context.
- 范围: Added localized `ctaLabel` copy and an `aria-label` on the focus card
  link; updated the dashboard test to assert the accessible link name and href.
- 不做: Do not change the visible CTA label or focus priority selection.
- 受益: Assistive technology users hear the recommended action and the specific
  target in one control name.

### Cycle 14: Evidence Missing Chip Accessible Labels

- 状态: Implemented.
- 目标: Make compact missing-evidence chips readable as full evidence status
  statements for assistive technology.
- 范围: Added localized `evidence.missingItem` copy and `aria-label` values to
  missing evidence chips; covered the implemented-evidence missing chip in the
  issue detail test.
- 不做: Do not change visible chip text or evidence counting semantics.
- 受益: Reviewers using screen readers get complete evidence status rather than
  terse numeric chips.

### Cycle 15: Third Loop Audit and Validation

- 状态: Completed.
- 目标: Re-check Cycles 11-14, run focused validation, and mark remaining
  environment-dependent items accurately.
- 范围: Ran the focused Web suite
  `pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx app/loops/loops-dashboard-model.test.ts app/loops/page.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  and Web type-check `pnpm --filter @repo/web type-check`.
- 不做: Do not perform real SSO tenant validation or browser screenshot QA in
  this code-only pass.
- 受益: The third implementation loop is verified, type-safe, and documents the
  exact remaining external validation boundary.

## Still Deferred After Cycle 15

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Dashboard

- 目标: Verify the operator focus card, readiness checklist, and evidence chips
  remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Fourth Follow-up Execution Cycles

### Cycle 16: Detail Primary Action Conditional Description

- 状态: Implemented.
- 目标: Avoid pointing `Continue Loop` at a missing diagnostic element while
  keeping closed/gated states connected to their concrete diagnostics.
- 范围: Added `hasNextActionDiagnostic` and only set `aria-describedby` when an
  actual next-action diagnostic panel renders; added a closed-issue regression
  proving the attribute points at the closed-state diagnostic.
- 不做: Do not change closed issue semantics or scheduler action availability.
- 受益: The accessibility tree remains accurate across both gated and no-action
  detail states.

### Cycle 17: Intake Readiness Region Coverage

- 状态: Implemented.
- 目标: Lock the readiness checklist as a named region, not just a collection of
  repeated status strings.
- 范围: Updated the simple intake test to query the `Create readiness` region
  and assert request, workspace, tenant, preview, and status labels within that
  region.
- 不做: Do not change readiness layout or submission behavior.
- 受益: Future UI edits are less likely to break the checklist's accessible
  boundary or scatter readiness copy outside the intended region.

### Cycle 18: Operator Focus Fallback Locale Coverage

- 状态: Implemented.
- 目标: Guard the localized create fallback copy used when operator focus has no
  review, exception, or continue action.
- 范围: Added a dashboard test that asserts the English locale includes create
  fallback title, meta, action, and CTA label strings used by the page fallback
  path.
- 不做: Do not rewrite the dashboard hook mocks or create a separate empty-state
  fixture in this pass.
- 受益: The model/UI split from Cycle 7 remains protected against missing
  locale keys.

### Cycle 19: Deferred Boundary Consolidation

- 状态: Implemented.
- 目标: Consolidate the remaining PM/UX optimization boundary after four
  implementation loops so future passes do not chase duplicate historical
  deferred sections.
- 范围: Added a current deferred boundary below Cycle 19 and explicitly treated
  the Cycle 10 and Cycle 15 deferred lists as historical checkpoints.
- 不做: Do not delete earlier audit history or mark external SSO/browser
  validation as completed without running those environments.
- 受益: The document now has one current source of truth for what remains after
  the implemented code and test work.

## Current Deferred Boundary After Cycle 19

Earlier `Still Deferred` sections are historical checkpoints. The current
remaining PM/UX boundary is:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, readiness checklist, and evidence chips
  remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, focus landmarks, and anchor
  flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 20: Fourth Loop Audit and Validation

- 状态: Completed.
- 目标: Re-check Cycles 16-19, run focused validation, and mark the current
  implementation boundary accurately.
- 范围: Ran the focused Web suite
  `pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx app/loops/loops-dashboard-model.test.ts app/loops/page.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 4 files and 67 tests passing; ran Web type-check
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not perform real SSO tenant validation or browser screenshot QA in
  this code-only pass.
- 受益: The fourth implementation loop is verified, type-safe, and leaves one
  current deferred boundary for environment-dependent product validation.

## Still Deferred After Cycle 20

Use this section, not the historical Cycle 10 or Cycle 15 checkpoints, as the
active follow-up boundary.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, readiness checklist, and evidence chips
  remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, focus landmarks, and anchor
  flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Fifth Follow-up Execution Cycles

### Cycle 21: Intake Submit Status Description

- 状态: Implemented.
- 目标: Make the simple intake submit button explain its current blocked or
  ready state through the button accessibility path.
- 范围: Added a stable submit status id, connected the Create Issue button with
  `aria-describedby`, and covered request-short, request-ready, and
  workspace-missing states in the simple intake test.
- 不做: Do not change submit blocking rules, workspace selection behavior, or
  creation payload shape.
- 受益: Keyboard and screen-reader users can discover why Create Issue is
  disabled or ready without hunting for nearby helper text.

### Cycle 22: Intake Preview Named Region

- 状态: Implemented.
- 目标: Make the simple intake preview discoverable as a named region whose name
  comes from visible page text.
- 范围: Changed the preview section from `aria-label` to `aria-labelledby`,
  added a stable preview heading id, and updated the simple intake test to query
  preview content within the `Preview` region.
- 不做: Do not change preview normalization, template selection, or preview
  layout.
- 受益: Assistive technology and tests now share the same visible heading as the
  preview navigation boundary.

### Cycle 23: Detail Evidence Coverage Named Region

- 状态: Implemented.
- 目标: Make the detail evidence coverage card directly discoverable as a named
  audit region.
- 范围: Added generated heading ids and `aria-labelledby` wiring to the shared
  detail `SectionCard`, then updated the missing-evidence test to assert
  evidence metrics and chips inside the `Evidence Coverage` region.
- 不做: Do not change evidence counting, evidence labels, or the visual card
  hierarchy.
- 受益: Reviewers can navigate directly to evidence coverage and tests now prove
  the evidence summary stays inside the intended audit boundary.

### Cycle 24: Pending Item Review After Local UX Fixes

- 状态: Completed.
- 目标: Review the remaining PM/UX implementation queue after Cycles 21-23 and
  avoid treating environment validation as a code-only task.
- 范围: Re-checked the current deferred boundary and confirmed the remaining
  active items are real SSO tenant validation and browser visual QA; also
  cleaned touched test/import formatting while keeping the code changes scoped
  to Loops intake/detail UX.
- 不做: Do not mark SSO tenant validation or screenshot QA as completed without
  running those external flows.
- 受益: The next operator has an accurate implementation boundary and does not
  repeat code-level accessibility work that is now covered by tests.

## Current Deferred Boundary After Cycle 24

Use this section as the active follow-up boundary after the fifth local
implementation loop.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, readiness checklist, preview region,
  evidence coverage region, and evidence chips remain readable at desktop and
  mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, focus landmarks, and anchor
  flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 25: Fifth Loop Audit and Validation

- 状态: Completed.
- 目标: Validate the fifth local implementation loop and record the remaining
  external validation boundary accurately.
- 范围: Ran focused Web tests
  `pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 2 files and 30 tests passing; ran
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not run real SSO tenant validation or browser screenshot QA in this
  code-only pass.
- 受益: Cycles 21-24 are test-backed and type-safe, while the document remains
  honest about the two environment-dependent PM/UX follow-ups.

## Still Deferred After Cycle 25

Only environment-dependent validation remains active:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, readiness checklist, preview region,
  evidence coverage region, and evidence chips remain readable at desktop and
  mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, focus landmarks, and anchor
  flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Sixth Follow-up Execution Cycles

### Cycle 26: Intake Readiness Visible Heading Boundary

- 状态: Implemented.
- 目标: Make the simple intake readiness checklist use its visible heading as
  the region name, matching the preview region pattern.
- 范围: Replaced the readiness section's direct `aria-label` with
  `aria-labelledby`, added a stable readiness heading id, and re-ran the simple
  intake test that queries the `Create readiness` region.
- 不做: Do not change readiness items, tones, copy, or submit blocking rules.
- 受益: Assistive technology, visual users, and tests now share the same
  visible heading as the readiness checklist boundary.

### Cycle 27: Intake Submit Live Status Role

- 状态: Implemented.
- 目标: Make the simple intake submit guidance an explicit live status region,
  while preserving the Create Issue button description.
- 范围: Added `role="status"` to the submit guidance, updated the submit test to
  query the status role, and kept `aria-describedby` coverage for blocked and
  ready states.
- 不做: Do not change submit copy, timing, or validation thresholds.
- 受益: Status changes are clearer for assistive technology users as the request
  moves from blocked to ready.

### Cycle 28: Evidence Complete Region Regression

- 状态: Implemented.
- 目标: Ensure the complete evidence state is verified inside the same named
  evidence coverage audit region as missing evidence.
- 范围: Updated the complete-evidence detail test to query the `Evidence
Coverage` region and assert `Evidence complete` plus the complete summary
  inside that boundary.
- 不做: Do not change evidence completion rules, artifact counts, or card copy.
- 受益: Both missing and complete evidence states are now guarded against
  drifting outside the intended audit region.

### Cycle 29: Pending Item Review After Region/Status Tightening

- 状态: Completed.
- 目标: Re-check the PM/UX queue after Cycles 26-28 and separate local code
  coverage from environment-only validation.
- 范围: Reviewed the intake readiness, submit status, and evidence coverage
  changes; confirmed the remaining active follow-ups are still real SSO tenant
  validation and browser visual QA.
- 不做: Do not create artificial code work for validation that requires a real
  browser session or SSO tenant state.
- 受益: The document remains accurate after the sixth local implementation loop
  and keeps external validation visible as the only active boundary.

## Current Deferred Boundary After Cycle 29

Use this section as the active follow-up boundary after Cycles 26-28.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, readiness checklist, preview region,
  submit status, evidence coverage region, and evidence chips remain readable at
  desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, focus landmarks, status
  announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 30: Sixth Loop Audit and Validation

- 状态: Completed.
- 目标: Validate the sixth local implementation loop and record the current
  external validation boundary.
- 范围: Ran focused Web tests
  `pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 2 files and 30 tests passing; ran
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not run real SSO tenant validation or browser screenshot QA in this
  code-only pass.
- 受益: Cycles 26-29 are verified and type-safe, and the document remains clear
  that only environment-dependent validation remains.

## Still Deferred After Cycle 30

Only environment-dependent validation remains active:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, readiness checklist, preview region,
  submit status, evidence coverage region, and evidence chips remain readable at
  desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, focus landmarks, status
  announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Seventh Follow-up Execution Cycles

### Cycle 31: Intake Request Label And Hint Separation

- 状态: Implemented.
- 目标: Keep the primary request field's accessible name focused on the field
  label while exposing the helper copy as a description.
- 范围: Replaced the wrapper label with explicit `htmlFor`,
  `aria-labelledby`, and `aria-describedby` wiring for the request textarea;
  updated the simple intake test to assert the textbox name and hint
  description separately.
- 不做: Do not change request copy, validation threshold, or input layout.
- 受益: Screen-reader users hear a concise field name first, then the guidance
  as supporting description.

### Cycle 32: Intake Request Invalid State

- 状态: Implemented.
- 目标: Expose the request field's minimum-length validation state directly on
  the primary textarea.
- 范围: Added `aria-invalid` based on the 10-character threshold and covered the
  invalid-to-valid transition in the simple intake test.
- 不做: Do not change the disabled submit behavior or introduce an unreachable
  submit error path.
- 受益: Assistive technology users can tell that the request field itself is the
  blocking input until enough detail is entered.

### Cycle 33: Pending Item Review After Request Field Tightening

- 状态: Completed.
- 目标: Re-check the local PM/UX queue after request-field semantic fixes and
  keep external validation separate.
- 范围: Reviewed the request label, hint, invalid state, readiness, preview, and
  submit status coverage; confirmed the remaining active follow-ups are still
  real SSO tenant validation and browser visual QA.
- 不做: Do not treat disabled-button validation branches as reachable user
  flows, and do not mark SSO/browser validation complete from component tests.
- 受益: The document reflects the current local implementation state without
  blurring it with environment-dependent checks.

## Current Deferred Boundary After Cycle 34

Use this section as the active follow-up boundary after request-field semantic
tightening.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, request field, readiness checklist,
  preview region, submit status, evidence coverage region, and evidence chips
  remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, focus landmarks, request
  label/hint placement, invalid-state readability, status announcement
  placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 34: Deferred Boundary Refresh After Request Semantics

- 状态: Completed.
- 目标: Refresh the active deferred boundary so browser QA includes the newly
  tightened request field semantics.
- 范围: Updated the current browser visual pass checklist to include request
  label/hint placement and invalid-state readability on `/loops/new`.
- 不做: Do not duplicate older deferred sections or claim visual QA has run.
- 受益: The remaining browser validation instructions now match the UI semantics
  that are actually implemented.

### Cycle 35: Seventh Loop Audit and Validation

- 状态: Completed.
- 目标: Validate the seventh local implementation loop and record the current
  external validation boundary.
- 范围: Ran focused Web tests
  `pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 2 files and 31 tests passing; ran
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not run real SSO tenant validation or browser screenshot QA in this
  code-only pass.
- 受益: Cycles 31-34 are verified and type-safe, while the remaining work is
  accurately constrained to environment-dependent validation.

## Still Deferred After Cycle 35

Only environment-dependent validation remains active:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, request field, readiness checklist,
  preview region, submit status, evidence coverage region, and evidence chips
  remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, focus landmarks, request
  label/hint placement, invalid-state readability, status announcement
  placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Eighth Follow-up Execution Cycles

### Cycle 36: Intake Unreachable Request Error Cleanup

- 状态: Implemented.
- 目标: Remove an unreachable request error state now that disabled submit and
  `aria-invalid` cover the minimum-length path.
- 范围: Removed `requestError` state and rendering from the simple intake form;
  re-ran the simple intake test suite to confirm no reachable behavior changed.
- 不做: Do not change the request threshold, submit disabled rules, or visible
  helper copy.
- 受益: The form has one clear validation path for the primary request field,
  reducing product and maintenance ambiguity.

### Cycle 37: Intake Workspace Missing Alert

- 状态: Implemented.
- 目标: Make the missing workspace configuration problem announce as an alert,
  not only as passive helper text.
- 范围: Added `role="alert"` and a stable id to the workspace-required message;
  updated the no-workspace intake test to assert the alert and submit status.
- 不做: Do not change workspace discovery, creation blocking, or fallback
  workspace behavior.
- 受益: Operators and assistive technology users get a clearer signal that
  workspace setup is required before issue creation.

### Cycle 38: Intake Workspace Select Error Description

- 状态: Implemented.
- 目标: Connect the workspace configuration error to the disabled Workspace
  selector itself.
- 范围: Added conditional `aria-describedby` from the Workspace select to the
  workspace-required alert and updated the no-workspace test to assert the
  select's accessible description.
- 不做: Do not enable selection when no workspaces exist or change workspace
  query behavior.
- 受益: Users who focus the Workspace control understand why it is disabled and
  what setup is required.

### Cycle 39: Pending Item Review After Workspace Error Semantics

- 状态: Completed.
- 目标: Re-check the PM/UX queue after workspace error semantics were tightened
  and refresh the external validation boundary.
- 范围: Reviewed request validation, workspace alert, Workspace select
  description, readiness, preview, submit status, and evidence coverage; updated
  the active browser QA checklist below to include workspace-missing states.
- 不做: Do not mark SSO tenant validation or browser screenshot QA complete from
  component tests.
- 受益: The current deferred boundary now matches the form states that need
  visual validation in a real browser.

## Current Deferred Boundary After Cycle 39

Use this section as the active follow-up boundary after workspace error
semantic tightening.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, request field, workspace selector,
  readiness checklist, preview region, submit status, evidence coverage region,
  and evidence chips remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, focus landmarks, request
  label/hint placement, invalid-state readability, workspace-missing alert and
  disabled selector readability, status announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 49: Deferred Boundary Refresh After Detail Semantics

- 状态: Completed.
- 目标: Refresh the active deferred boundary so browser QA covers the newly
  named issue-detail semantic areas.
- 范围: Updated the browser visual pass checklist to include issue-detail Next
  Action placement, tenant audit wrapping, and the existing evidence coverage
  region.
- 不做: Do not claim browser visual QA has run, and do not add environment-only
  SSO assertions to component tests.
- 受益: The next validation handoff now matches the actual PM/UX states exposed
  by the current implementation.

### Cycle 50: Tenth Loop Audit and Validation

- 状态: Completed.
- 目标: Validate the tenth local implementation loop and record the current
  external validation boundary.
- 范围: Ran focused Web tests
  `pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 2 files and 32 tests passing; ran
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not run real SSO tenant validation or browser screenshot QA in this
  code-only pass.
- 受益: Cycles 46-49 are verified and type-safe, while remaining work stays
  accurately constrained to environment-dependent validation.

## Still Deferred After Cycle 50

Only environment-dependent validation remains active:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, request field, workspace selector,
  create-failure alert, readiness checklist, preview region, submit status,
  issue-detail Next Action region, detail tenant audit group, evidence coverage
  region, and evidence chips remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, request label/hint placement, invalid-state readability,
  workspace-missing alert and disabled selector readability, create-failure
  alert placement, detail Next Action placement, tenant audit wrapping, status
  announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Eleventh Follow-up Execution Cycles

### Cycle 51: Dashboard Exception Center Region

- 状态: Implemented.
- 目标: Make the dashboard Exception Center a named region that matches the
  navigation anchor and operator focus target.
- 范围: Added `aria-labelledby` to the Exception Center section and upgraded the
  dashboard regression to assert exception summary content within that region.
- 不做: Do not change exception prioritization, runtime diagnostics, or
  dashboard information architecture.
- 受益: Operators, tests, and assistive technology can jump directly to the
  exception queue instead of scanning the full dense dashboard.

### Cycle 52: Dashboard Review Inbox Region

- 状态: Implemented.
- 目标: Make the dashboard Review Inbox a named region that matches the
  decision-queue navigation anchor.
- 范围: Converted the Review Inbox container into a labeled section and upgraded
  the dashboard regression to assert review-needed and human-input copy inside
  that region.
- 不做: Do not change review grouping, SLA logic, or decision queue ordering.
- 受益: Human reviewers can identify the decision queue as a distinct dashboard
  surface, which also strengthens browser QA and regression tests.

### Cycle 53: Pending Item Review After Dashboard Regions

- 状态: Completed.
- 目标: Re-check the PM/UX queue after dashboard decision and exception regions
  were tightened.
- 范围: Reviewed the operator focus card, workbench rail anchors, Exception
  Center, Review Inbox, issue detail regions, and intake readiness states;
  confirmed local code changes now cover the remaining semantic gaps found in
  this pass.
- 不做: Do not mark browser visual QA or real SSO tenant validation complete
  from React component tests.
- 受益: The PM handoff now reflects that dashboard navigation landmarks are
  implemented, while visual density and identity validation remain environment
  work.

## Current Deferred Boundary After Cycle 53

Use this section as the active follow-up boundary after dashboard landmark
tightening.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, dashboard Review Inbox region,
  dashboard Exception Center region, request field, workspace selector,
  create-failure alert, readiness checklist, preview region, submit status,
  issue-detail Next Action region, detail tenant audit group, evidence coverage
  region, and evidence chips remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, dashboard anchor flow into Review Inbox / Exception Center,
  request label/hint placement, invalid-state readability, workspace-missing
  alert and disabled selector readability, create-failure alert placement,
  detail Next Action placement, tenant audit wrapping, status announcement
  placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 54: Deferred Boundary Refresh After Dashboard Landmarks

- 状态: Completed.
- 目标: Refresh the active deferred boundary so browser QA covers the newly
  named dashboard decision and exception areas.
- 范围: Updated the browser visual pass checklist to include Review Inbox and
  Exception Center region readability plus anchor flow from the dashboard rail
  and operator focus card.
- 不做: Do not duplicate older deferred sections or claim visual QA has run.
- 受益: The remaining browser QA task now matches the dashboard landmarks that
  are implemented in code.

### Cycle 55: Eleventh Loop Audit and Validation

- 状态: Completed.
- 目标: Validate the eleventh local implementation loop and record the current
  external validation boundary.
- 范围: Ran focused Web tests
  `pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 3 files and 38 tests passing; ran
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not run real SSO tenant validation or browser screenshot QA in this
  code-only pass.
- 受益: Cycles 51-54 are verified and type-safe, while remaining work stays
  accurately constrained to environment-dependent validation.

## Still Deferred After Cycle 55

Only environment-dependent validation remains active:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, dashboard Review Inbox region,
  dashboard Exception Center region, request field, workspace selector,
  create-failure alert, readiness checklist, preview region, submit status,
  issue-detail Next Action region, detail tenant audit group, evidence coverage
  region, and evidence chips remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, dashboard anchor flow into Review Inbox / Exception Center,
  request label/hint placement, invalid-state readability, workspace-missing
  alert and disabled selector readability, create-failure alert placement,
  detail Next Action placement, tenant audit wrapping, status announcement
  placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Twelfth Follow-up Execution Cycles

### Cycle 56: Dashboard Loop Board Region

- 状态: Implemented.
- 目标: Make the dashboard Loop Board anchor discoverable as a named region.
- 范围: Added `aria-labelledby` to the `loop-board` section and upgraded the
  dashboard regression to assert backlog and summary copy within the Loop Board
  region.
- 不做: Do not change board column grouping, issue ordering, or board card
  contents.
- 受益: Operators and browser QA can jump directly to delivery-stage scanning
  without relying on text search across the whole dashboard.

### Cycle 57: Dashboard Runtime Backends Region

- 状态: Implemented.
- 目标: Make runtime backend readiness discoverable as a named dashboard region.
- 范围: Added `aria-labelledby` to the `runtime-panel` section and upgraded the
  dashboard regression to assert runtime readiness and backend names within that
  region.
- 不做: Do not change runtime detection, retry behavior, or backend status
  classification.
- 受益: Operators can inspect runtime readiness as a distinct product surface,
  and visual/browser QA gains a stable target for runtime density checks.

### Cycle 58: Pending Item Review After Board And Runtime Regions

- 状态: Completed.
- 目标: Re-check the PM/UX queue after Loop Board and Runtime Backends became
  named dashboard regions.
- 范围: Reviewed the dashboard guide, operator focus, Loop Board, Runtime
  Backends, Review Inbox, Exception Center, intake readiness, and issue-detail
  regions; found no additional local semantic gaps worth changing in this pass.
- 不做: Do not treat component tests as evidence for responsive browser visual
  quality or real SSO tenant persistence.
- 受益: The PM log now reflects that core dashboard anchor targets are
  implemented and test-addressable.

## Current Deferred Boundary After Cycle 58

Use this section as the active follow-up boundary after dashboard board/runtime
landmark tightening.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, dashboard Loop Board region, Runtime
  Backends region, Review Inbox region, Exception Center region, request field,
  workspace selector, create-failure alert, readiness checklist, preview
  region, submit status, issue-detail Next Action region, detail tenant audit
  group, evidence coverage region, and evidence chips remain readable at
  desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, dashboard anchor flow into Loop Board / Runtime Backends /
  Review Inbox / Exception Center, request label/hint placement, invalid-state
  readability, workspace-missing alert and disabled selector readability,
  create-failure alert placement, detail Next Action placement, tenant audit
  wrapping, status announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 64: Deferred Boundary Refresh After Quality And Release Landmarks

- 状态: Completed.
- 目标: Refresh the active deferred boundary so browser QA includes the newly
  named Eval Plan and Release Readiness regions.
- 范围: Updated the browser visual pass checklist to include dashboard anchor
  flow and readability checks for Eval Plan and Release Readiness.
- 不做: Do not claim browser screenshot QA has run or attach visual artifacts in
  this code-only pass.
- 受益: The remaining validation checklist now mirrors the dashboard quality and
  release landmarks implemented in code.

### Cycle 65: Thirteenth Loop Audit and Validation

- 状态: Completed.
- 目标: Validate the thirteenth local implementation loop and record the current
  external validation boundary.
- 范围: Ran focused Web tests
  `pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 3 files and 38 tests passing; ran
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not run real SSO tenant validation or browser screenshot QA in this
  code-only pass.
- 受益: Cycles 61-64 are verified and type-safe, while remaining work stays
  accurately constrained to environment-dependent validation.

## Still Deferred After Cycle 65

Only environment-dependent validation remains active:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, dashboard Loop Board region, Runtime
  Backends region, Eval Plan region, Release Readiness region, Review Inbox
  region, Exception Center region, request field, workspace selector,
  create-failure alert, readiness checklist, preview region, submit status,
  issue-detail Next Action region, detail tenant audit group, evidence coverage
  region, and evidence chips remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, dashboard anchor flow into Loop Board / Runtime Backends /
  Eval Plan / Release Readiness / Review Inbox / Exception Center, request
  label/hint placement, invalid-state readability, workspace-missing alert and
  disabled selector readability, create-failure alert placement, detail Next
  Action placement, tenant audit wrapping, status announcement placement, and
  anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Fourteenth Follow-up Execution Cycles

### Cycle 66: Dashboard Trigger Portfolio Region

- 状态: Implemented.
- 目标: Make Trigger Portfolio discoverable as a named dashboard region.
- 范围: Added `aria-labelledby` to the Trigger Portfolio section and upgraded
  the dashboard regression to assert source and recent trigger copy within that
  region.
- 不做: Do not change trigger aggregation, source grouping, or intake ordering.
- 受益: Operators can inspect where loops are entering the system without
  scanning adjacent release or repository panels.

### Cycle 67: Dashboard Repo Context Region

- 状态: Implemented.
- 目标: Make Repo Context Map discoverable as a named dashboard region.
- 范围: Added `aria-labelledby` to the Repo Context Map section and upgraded
  the dashboard regression to assert repository summary and phase counts within
  that region.
- 不做: Do not change repository grouping, blocked counts, or issue phase
  mapping.
- 受益: Operators can jump directly to repository-level context when deciding
  which loop or workspace needs attention next.

### Cycle 68: Pending Item Review After Source And Repo Regions

- 状态: Completed.
- 目标: Re-check the PM/UX queue after trigger/source and repository context
  panels became named regions.
- 范围: Reviewed Trigger Portfolio, Repo Context Map, Eval Plan, Release
  Readiness, Loop Board, Runtime Backends, Review Inbox, Exception Center,
  intake readiness, and issue-detail regions; confirmed remaining active work
  still depends on browser/SSO environments.
- 不做: Do not claim repository or trigger visual density is validated from
  component tests.
- 受益: The implementation log now reflects that source and repository context
  panels are implemented as addressable PM surfaces.

## Current Deferred Boundary After Cycle 68

Use this section as the active follow-up boundary after trigger/repository
landmark tightening.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, dashboard Trigger Portfolio region,
  Repo Context Map region, Loop Board region, Runtime Backends region, Eval
  Plan region, Release Readiness region, Review Inbox region, Exception Center
  region, request field, workspace selector, create-failure alert, readiness
  checklist, preview region, submit status, issue-detail Next Action region,
  detail tenant audit group, evidence coverage region, and evidence chips
  remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, dashboard anchor flow into Trigger Portfolio / Repo Context
  Map / Loop Board / Runtime Backends / Eval Plan / Release Readiness / Review
  Inbox / Exception Center, request label/hint placement, invalid-state
  readability, workspace-missing alert and disabled selector readability,
  create-failure alert placement, detail Next Action placement, tenant audit
  wrapping, status announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 69: Deferred Boundary Refresh After Source And Repo Landmarks

- 状态: Completed.
- 目标: Refresh the active deferred boundary so browser QA includes the newly
  named Trigger Portfolio and Repo Context Map regions.
- 范围: Updated the browser visual pass checklist to include dashboard anchor
  flow and readability checks for trigger/source and repository context panels.
- 不做: Do not claim browser screenshot QA has run or attach visual artifacts in
  this code-only pass.
- 受益: The remaining validation checklist now mirrors the dashboard source and
  repository landmarks implemented in code.

### Cycle 70: Fourteenth Loop Audit and Validation

- 状态: Completed.
- 目标: Validate the fourteenth local implementation loop and record the current
  external validation boundary.
- 范围: Ran focused Web tests
  `pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 3 files and 38 tests passing; ran
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not run real SSO tenant validation or browser screenshot QA in this
  code-only pass.
- 受益: Cycles 66-69 are verified and type-safe, while remaining work stays
  accurately constrained to environment-dependent validation.

## Still Deferred After Cycle 70

Only environment-dependent validation remains active:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, dashboard Trigger Portfolio region,
  Repo Context Map region, Loop Board region, Runtime Backends region, Eval
  Plan region, Release Readiness region, Review Inbox region, Exception Center
  region, request field, workspace selector, create-failure alert, readiness
  checklist, preview region, submit status, issue-detail Next Action region,
  detail tenant audit group, evidence coverage region, and evidence chips
  remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, dashboard anchor flow into Trigger Portfolio / Repo Context
  Map / Loop Board / Runtime Backends / Eval Plan / Release Readiness / Review
  Inbox / Exception Center, request label/hint placement, invalid-state
  readability, workspace-missing alert and disabled selector readability,
  create-failure alert placement, detail Next Action placement, tenant audit
  wrapping, status announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 59: Deferred Boundary Refresh After Board And Runtime Landmarks

- 状态: Completed.
- 目标: Refresh the active deferred boundary so browser QA includes the newly
  named Loop Board and Runtime Backends regions.
- 范围: Updated the browser visual pass checklist to include dashboard anchor
  flow into Loop Board and Runtime Backends alongside Review Inbox and
  Exception Center.
- 不做: Do not claim browser visual QA has run or add screenshot artifacts from
  component tests.
- 受益: The remaining validation checklist now mirrors the dashboard landmarks
  implemented in code.

### Cycle 60: Twelfth Loop Audit and Validation

- 状态: Completed.
- 目标: Validate the twelfth local implementation loop and record the current
  external validation boundary.
- 范围: Ran focused Web tests
  `pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 3 files and 38 tests passing; ran
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not run real SSO tenant validation or browser screenshot QA in this
  code-only pass.
- 受益: Cycles 56-59 are verified and type-safe, while remaining work stays
  accurately constrained to environment-dependent validation.

## Still Deferred After Cycle 60

Only environment-dependent validation remains active:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, dashboard Loop Board region, Runtime
  Backends region, Review Inbox region, Exception Center region, request field,
  workspace selector, create-failure alert, readiness checklist, preview
  region, submit status, issue-detail Next Action region, detail tenant audit
  group, evidence coverage region, and evidence chips remain readable at
  desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, dashboard anchor flow into Loop Board / Runtime Backends /
  Review Inbox / Exception Center, request label/hint placement, invalid-state
  readability, workspace-missing alert and disabled selector readability,
  create-failure alert placement, detail Next Action placement, tenant audit
  wrapping, status announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Thirteenth Follow-up Execution Cycles

### Cycle 61: Dashboard Eval Plan Region

- 状态: Implemented.
- 目标: Make the Eval Plan quality-gate summary discoverable as a named
  dashboard region.
- 范围: Added `aria-labelledby` to the Eval Plan section and upgraded the
  dashboard regression to assert quality-gate summary, checks, and hard-gate
  copy within that region.
- 不做: Do not change eval scoring, hard-gate policy, or quality signal
  derivation.
- 受益: Operators can jump directly to release-blocking quality signals, and
  browser QA gains a stable target for dense quality-gate screenshots.

### Cycle 62: Dashboard Release Readiness Region

- 状态: Implemented.
- 目标: Make Release Readiness discoverable as a named dashboard region.
- 范围: Added `aria-labelledby` to the Release Readiness section and upgraded
  the dashboard regression to assert readiness summary and empty-state copy
  within that region.
- 不做: Do not change release readiness state calculation, release gating, or
  link targets.
- 受益: Operators can distinguish release readiness from adjacent CI evidence
  and trigger portfolio panels while scanning the dashboard.

### Cycle 63: Pending Item Review After Quality And Release Regions

- 状态: Completed.
- 目标: Re-check the PM/UX queue after Eval Plan and Release Readiness became
  named dashboard regions.
- 范围: Reviewed dashboard guide, Eval Plan, Release Readiness, Loop Board,
  Runtime Backends, Review Inbox, Exception Center, intake readiness, and issue
  detail regions; confirmed remaining active work is browser/SSO environment
  validation.
- 不做: Do not mark release-readiness visual density or SSO tenant persistence
  complete from component tests.
- 受益: The PM log now reflects that quality-gate and release-readiness panels
  are implemented as addressable product surfaces.

## Current Deferred Boundary After Cycle 63

Use this section as the active follow-up boundary after quality/release
landmark tightening.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, dashboard Loop Board region, Runtime
  Backends region, Eval Plan region, Release Readiness region, Review Inbox
  region, Exception Center region, request field, workspace selector,
  create-failure alert, readiness checklist, preview region, submit status,
  issue-detail Next Action region, detail tenant audit group, evidence coverage
  region, and evidence chips remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, dashboard anchor flow into Loop Board / Runtime Backends /
  Eval Plan / Release Readiness / Review Inbox / Exception Center, request
  label/hint placement, invalid-state readability, workspace-missing alert and
  disabled selector readability, create-failure alert placement, detail Next
  Action placement, tenant audit wrapping, status announcement placement, and
  anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 40: Eighth Loop Audit and Validation

- 状态: Completed.
- 目标: Validate the eighth local implementation loop and record the current
  external validation boundary.
- 范围: Ran focused Web tests
  `pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 2 files and 31 tests passing; ran
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not run real SSO tenant validation or browser screenshot QA in this
  code-only pass.
- 受益: Cycles 36-39 are verified and type-safe, while remaining work stays
  accurately constrained to environment-dependent validation.

## Still Deferred After Cycle 40

Only environment-dependent validation remains active:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, request field, workspace selector,
  readiness checklist, preview region, submit status, evidence coverage region,
  and evidence chips remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, and one
  `/loops/:issueId` screenshot for at least desktop and mobile viewports,
  checking text wrapping, first-screen hierarchy, focus landmarks, request
  label/hint placement, invalid-state readability, workspace-missing alert and
  disabled selector readability, status announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Ninth Follow-up Execution Cycles

### Cycle 41: Intake Create Failure Alert

- 状态: Implemented.
- 目标: Make failed issue creation announce as an error state, not only appear
  as passive red text.
- 范围: Added a focused simple-intake regression for create failures and gave
  the create-error message a stable id plus `role="alert"`.
- 不做: Do not change mutation retry behavior, backend error contracts, or
  successful create navigation.
- 受益: Operators and assistive technology users receive an immediate, explicit
  signal when issue creation fails and they need to retry.

### Cycle 42: Intake Submit Button Failure Description

- 状态: Implemented.
- 目标: Ensure the Create Issue control carries the failure context when issue
  creation has failed.
- 范围: Added conditional submit-button `aria-describedby` wiring for the
  create-error alert and extended the create-failure regression to assert the
  combined submit status plus retry guidance description.
- 不做: Do not add a new retry button, alter disabled rules, or change the
  visible CTA copy.
- 受益: Keyboard and screen-reader users can refocus the primary action and hear
  both current readiness and the latest create failure without hunting nearby
  text.

### Cycle 43: Pending Item Review After Create Failure Semantics

- 状态: Completed.
- 目标: Re-check the PM/UX queue after create-failure semantics were tightened.
- 范围: Reviewed the simple intake request gate, workspace gate, create-failure
  alert, submit description, readiness checklist, and preview region; confirmed
  the remaining active work is still environment-dependent SSO and browser
  validation.
- 不做: Do not mark real SSO tenant validation or screenshot QA complete from
  component-level tests.
- 受益: The document now distinguishes finished local UX semantics from
  validation that still requires a running browser and identity environment.

## Current Deferred Boundary After Cycle 43

Use this section as the active follow-up boundary after create-failure semantic
tightening.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, request field, workspace selector,
  create-failure alert, readiness checklist, preview region, submit status,
  evidence coverage region, and evidence chips remain readable at desktop and
  mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, request label/hint placement, invalid-state readability,
  workspace-missing alert and disabled selector readability, create-failure
  alert placement, status announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

### Cycle 44: Deferred Boundary Refresh After Create Failure Semantics

- 状态: Completed.
- 目标: Refresh the active deferred boundary so browser QA includes the newly
  implemented create-failure state.
- 范围: Updated the current browser visual pass checklist to include
  create-failure alert placement and the submit-status interaction on
  `/loops/new`.
- 不做: Do not duplicate older deferred sections or claim visual QA has run.
- 受益: The remaining browser validation instructions now match the UI states
  that are actually implemented.

### Cycle 45: Ninth Loop Audit and Validation

- 状态: Completed.
- 目标: Validate the ninth local implementation loop and record the current
  external validation boundary.
- 范围: Ran focused Web tests
  `pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'`
  with 2 files and 32 tests passing; ran
  `pnpm --filter @repo/web type-check` successfully.
- 不做: Do not run real SSO tenant validation or browser screenshot QA in this
  code-only pass.
- 受益: Cycles 41-44 are verified and type-safe, while remaining work stays
  accurately constrained to environment-dependent validation.

## Still Deferred After Cycle 45

Only environment-dependent validation remains active:

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, request field, workspace selector,
  create-failure alert, readiness checklist, preview region, submit status,
  evidence coverage region, and evidence chips remain readable at desktop and
  mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, request label/hint placement, invalid-state readability,
  workspace-missing alert and disabled selector readability, create-failure
  alert placement, status announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.

## Tenth Follow-up Execution Cycles

### Cycle 46: Detail Tenant Audit Group

- 状态: Implemented.
- 目标: Make persisted tenant audit context in issue detail addressable as a
  distinct semantic group.
- 范围: Added a named `group` boundary around the Issue Intake tenant block and
  upgraded the detail regression to query tenant name and audit ids within that
  group.
- 不做: Do not change tenant persistence, SSO selection, or intake payload
  contracts.
- 受益: Reviewers and assistive technology users can locate tenant audit context
  directly instead of scanning the whole intake metadata card.

### Cycle 47: Detail Next Action Region

- 状态: Implemented.
- 目标: Make the issue detail primary next-action card discoverable as a named
  region.
- 范围: Added an `aria-labelledby` boundary to the Next Action card and updated
  the DRAFT-spec regression to assert `Review Spec` within that region.
- 不做: Do not change action priority, button enablement, or loop operation
  semantics.
- 受益: Users and tests can reliably identify the primary product action area
  before scanning dense evidence and control panels.

### Cycle 48: Pending Item Review After Detail Semantics

- 状态: Completed.
- 目标: Re-check the PM/UX queue after issue detail semantic boundaries were
  tightened.
- 范围: Reviewed issue detail intake metadata, tenant audit display, Next Action
  card, human-gate diagnostic, evidence coverage, and existing dashboard/intake
  deferred boundaries; confirmed the remaining active items still require real
  SSO/browser environments.
- 不做: Do not mark SSO tenant validation or screenshot QA complete from
  component tests, and do not expand this pass into runtime scheduler behavior.
- 受益: The implementation log now separates completed detail-page semantics
  from validation that must happen in a running app.

## Current Deferred Boundary After Cycle 48

Use this section as the active follow-up boundary after issue-detail semantic
tightening.

### PM-DEFER-01: Real SSO Tenant Validation

- 目标: Validate readiness and persisted tenant context with the real account
  and tenant path.
- 范围: After SSO callback/env alignment, run `/loops/new` for `13800138000`
  under tenant `优惠豚`, create an issue, and confirm readiness, detail tenant
  context, and audit records agree.
- 不做: Do not weaken OAuth redirect validation or add local-only tenant
  switching.
- 受益: Confirms product UX under real identity state, not only component tests
  and local storage mocks.

### PM-DEFER-02: Browser Visual Pass For Dense Loop Surfaces

- 目标: Verify the operator focus card, request field, workspace selector,
  create-failure alert, readiness checklist, preview region, submit status,
  issue-detail Next Action region, detail tenant audit group, evidence coverage
  region, and evidence chips remain readable at desktop and mobile widths.
- 范围: Start the Web app and capture `/loops`, `/loops/new`, one create-failure
  state on `/loops/new`, and one `/loops/:issueId` screenshot for at least
  desktop and mobile viewports, checking text wrapping, first-screen hierarchy,
  focus landmarks, request label/hint placement, invalid-state readability,
  workspace-missing alert and disabled selector readability, create-failure
  alert placement, detail Next Action placement, tenant audit wrapping, status
  announcement placement, and anchor flow.
- 不做: Do not redesign layout during this validation pass.
- 受益: Catches visual density and wrapping problems that unit tests cannot
  observe.
