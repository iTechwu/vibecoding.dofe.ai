# 0629 Follow-up Implementation Annotations

Date: 2026-06-29

This file tracks the requested implementation loops. Each loop records:

- implementation action
- validation
- documentation update
- remaining items review

## Cycle 1 - SSO Local/Test URL Alignment

Implementation:

- Added explicit environment URL overrides in
  `apps/api/src/modules/oidc-client-api/url-resolver.ts`.
- Supported API base override keys:
  - `VIBECODING_APP_BASE_URL`
  - `APP_BASE_URL`
  - `OIDC_APP_BASE_URL`
- Supported frontend base override keys:
  - `VIBECODING_APP_FRONTEND_URL`
  - `APP_FRONTEND_URL`
  - `OIDC_APP_FRONTEND_URL`

Validation:

- `pnpm --filter @repo/api exec jest src/modules/oidc-client-api/url-resolver.spec.ts --runInBand`
  passed.
- Added regression coverage proving loopback E2E overrides win over configured
  `vibecoding.local` domains.

Documentation update:

- BUG-01 / BUG-02 and OPZ-02 are now partially implemented at the app resolver
  level.
- Real SSO still depends on running the API with override values that match the
  SSO OAuth client registration.

Remaining review:

- Add dev script/env pass-through so the overrides work through `pnpm dev:api`.
- Re-run the real SSO authorize flow after the dev env pass-through cycle.

## Cycle 2 - Tenant Context Persistence and Detail Visibility

Implementation:

- Added `tenantContext` to the Loops Zod contracts for full issue creation,
  simple issue creation, issue records, and intake records.
- Derived tenant context in the Loops controller from authenticated request
  scope first (`tenantId` / `teamId` / `x-current-tenant`), with request body
  context as a compatibility fallback.
- Persisted tenant context on both issue and intake records, including the raw
  payload written during issue creation.
- Preserved `.loops` tenant context when DB-backed detail reads hydrate issue
  and intake records from the DB index.
- Carried `tenantContext` through the simple issue normalization path.
- Displayed tenant context on the issue detail intake card.

Validation:

- `pnpm --filter @repo/api exec jest libs/domain/services/loops-issues/loops-issues.service.spec.ts --runInBand`
  passed.
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` passed.
- `pnpm --filter @repo/web test -- 'app/loops/[issueId]/page.test.tsx' --runInBand`
  passed.

Documentation update:

- BUG-03 and UX-01 are now implemented for issue intake persistence and detail
  visibility.

Remaining review:

- `/loops/new` still needs a visible pre-submit tenant confirmation when the
  SSO tenant source is available to the frontend.
- Real tenant membership validation still depends on the upstream SSO/auth
  guard populating request tenant scope.

## Cycle 3 - Human Gate Runtime UX Clarification

Implementation:

- Added a human-gate execution state for phases owned by `human`.
- Updated the issue detail runtime panel so human review phases show:
  - `awaiting human review` as the panel meta state
  - `human review is required` under the current actor
  - `resumes after approval` instead of `not reported` for runtime mode
- Added English and Chinese locale strings.

Validation:

- `pnpm --filter @repo/web test -- 'app/loops/[issueId]/page.test.tsx' --runInBand`
  passed.

Documentation update:

- UX-02 is now implemented for issue detail runtime status.

Remaining review:

- Browser E2E should confirm the exact Chinese copy in the real `PHASE_2_REVIEW`
  issue flow after the final local run.

## Cycle 4 - Browser Resource Noise Reduction

Implementation:

- Added `metadata.icons.icon = '/logo.svg'` in the root web layout so pages
  advertise an existing icon asset.
- Added a `/favicon.ico` route that redirects default browser favicon requests
  to `/logo.svg`, removing the observed 404 resource failure without adding a
  binary asset.

Validation:

- `pnpm --filter @repo/web test -- app/favicon.ico/route.test.ts --runInBand`
  passed.

Documentation update:

- UX-04 is now partially implemented for the concrete 404 resource. Navigation
  aborts and preload warnings still need browser-runtime classification.

Remaining review:

- Final browser QA should verify `/favicon.ico` no longer returns 404.
- Expected React Query/navigation cancellations should be documented separately
  from genuine API failures after runtime console capture.

## Cycle 5 - Dev Runtime Environment and QA Noise Hygiene

Implementation:

- Added local E2E/auth-related variables to `turbo.json` `globalEnv` so
  `pnpm dev:api` / `turbo run dev --filter=@repo/api` preserve intentional
  local bypass and OIDC override values.
- Normalized `apps/web/next-env.d.ts` to the format emitted by Next dev, so
  local QA no longer leaves an unrelated quote-style diff.

Validation:

- `node -e "JSON.parse(require('fs').readFileSync('turbo.json','utf8')); console.log('turbo json ok')"`
  passed.

Documentation update:

- OPZ-05 and BUG-05 are implemented.
- OPZ-03 / OPZ-04 remain upstream infra-package work because RabbitMQ lifecycle
  logging is provided by `@dofe/infra-rabbitmq`, not this repository.

Remaining review:

- Final local API run should verify `MODE_USER_ID=... pnpm dev:api` reaches
  protected Loops routes.
- Upstream infra work should mask RabbitMQ credentials and downgrade benign
  shutdown races.

## Cycle 6 - Pre-submit Tenant Confirmation on Issue Intake

Implementation:

- Added a small `/loops/new` tenant hook that reads the current SSO tenant id
  from existing web storage.
- Displayed the current tenant on both simple and full issue intake forms before
  submission.
- Included `tenantContext.tenantId` in both simple and full issue submit
  payloads. The backend still treats request/auth tenant scope as authoritative
  and uses body context only as a compatibility fallback.

Validation:

- `pnpm --filter @repo/web test -- app/loops/new/simple-loop-issue-form.test.tsx app/loops/new/new-loop-issue-form.test.tsx --runInBand`
  passed: 12 suites, 77 tests.

Documentation update:

- UX-01 is now implemented for both pre-submit confirmation and issue-detail
  visibility.

Remaining review:

- Real browser SSO E2E should confirm the displayed tenant id/name matches
  `优惠豚` once the external SSO callback/client configuration is aligned.

## Cycle 7 - Progressive Disclosure for Fresh Issue Details

Implementation:

- Added a collapsible mode to the issue-detail `SectionCard` shell.
- Collapsed advanced delivery controls by default for fresh `PHASE_1_SPEC`
  issues that have no shards, implementation records, review records, test
  records, Browser QA reports, global review, or second-opinion evidence.
- Preserved the existing expanded operator view for in-progress issues with
  delivery evidence.

Validation:

- `pnpm --filter @repo/web test -- 'app/loops/[issueId]/page.test.tsx' --runInBand`
  passed: 12 suites, 78 tests.

Documentation update:

- UX-03 is implemented for first-run delivery-control progressive disclosure.

Remaining review:

- Browser E2E should create a fresh issue and confirm the advanced controls are
  collapsed before implementation evidence exists, then remain expanded on an
  active/in-progress issue.

## Cycle 8 - Runtime Docker Fallback Action Feedback

Implementation:

- Added an active pull state for runtime Docker image preparation on the Loops
  dashboard.
- Kept the existing `pull-image` action for `DOCKER_IMAGE_MISSING`, but now the
  clicked runtime shows `Pulling image...` while the mutation is pending.
- Triggered agent-runtime re-detection after a successful image pull mutation so
  operators immediately see the updated fallback readiness.

Validation:

- `pnpm --filter @repo/web test -- app/loops/page.test.tsx --runInBand`
  passed: 12 suites, 78 tests.

Documentation update:

- OPZ-01 is implemented at the dashboard action/result level.

Remaining review:

- Real Docker daemon validation should pull the Codex and Claude Code fallback
  images and confirm `/loops/agent-runtime` reports Docker candidates ready.

## Cycle 9 - Local/Test SSO Environment Documentation

Implementation:

- Documented the OIDC app URL override pair in `apps/api/.env.example`:
  `VIBECODING_APP_BASE_URL` and `VIBECODING_APP_FRONTEND_URL`.
- Documented the expected local callback URL and SSO tier alignment in
  `apps/web/.env.example`.
- Updated BUG-01, BUG-02, and OPZ-02 to distinguish repository-side
  configuration support from the remaining external SSO OAuth-client
  registration check.

Validation:

- `node -e "for (const f of ['apps/web/locales/en/loops.json','apps/web/locales/zh-CN/loops.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('locale json ok')"`
  passed.

Documentation update:

- BUG-01 / BUG-02 / OPZ-02 now point to concrete env variables and callback URL
  verification instead of an ambiguous config-alignment task.

Remaining review:

- Real SSO E2E must still confirm the external SSO test OAuth client allows
  `http://127.0.0.1:13100/auth/oidc/callback` or whichever override URL the
  team chooses for the run.

## Cycle 10 - Browser QA Navigation Noise Classification

Implementation:

- Extended the Browser QA report contract with optional
  `ignoredNetworkFailures` evidence.
- Classified Playwright `requestfailed` events with `ERR_ABORTED`, `AbortError`,
  `NS_BINDING_ABORTED`, `cancelled`, or `canceled` as
  `navigation-cancelled` ignored failures instead of hard QA failures.
- Kept true HTTP `4xx`/`5xx` responses and non-abort request failures as
  failing `networkFailures`.
- Surfaced ignored navigation-cancel counts in the issue-detail Browser QA
  artifact summary.

Validation:

- `pnpm --filter @repo/api exec jest libs/domain/services/loops-quality/loops-browser-qa-worker.service.spec.ts --runInBand`
  passed: 1 suite, 2 tests.
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` passed:
  1 suite, 18 tests.
- `pnpm --filter @repo/web test -- 'app/loops/[issueId]/page.test.tsx' --runInBand`
  passed: 12 suites, 78 tests.

Documentation update:

- UX-04 is implemented for favicon 404 removal and Browser QA navigation-cancel
  classification.

Remaining review:

- Full browser E2E should confirm real route transitions populate
  `ignoredNetworkFailures` for expected cancellations while genuine API failures
  continue to fail Browser QA.

## Cycle 11 - Readable Tenant Snapshot on Issue Intake

Implementation:

- Added a current-tenant snapshot storage helper that preserves tenant id,
  tenant name, and team id while keeping the legacy `currentTenant` id key.
- Synced readable tenant metadata from the SSO session adapter into that
  snapshot when SSO session restore succeeds.
- Updated simple and full `/loops/new` forms to show the readable tenant name
  first, with tenant/team audit identifiers underneath, and to submit the full
  tenant context payload when available.

Validation:

- `pnpm --filter @repo/web test -- app/loops/new/simple-loop-issue-form.test.tsx app/loops/new/new-loop-issue-form.test.tsx --runInBand`
  passed: 12 suites, 78 tests.

Documentation update:

- UX-01 and BUG-03 now record that readable tenant name/team confirmation is
  repository-side implemented, with real SSO validation still external.

Remaining review:

- Real SSO E2E must confirm the SSO session for `13800138000` exposes the
  `优惠豚` tenant snapshot and that created issues persist the same tenant
  context.

## Cycle 12 - Browser QA Ignored-Noise Evidence Summary

Implementation:

- Extended Browser QA evidence artifact summaries to include the number of
  ignored navigation cancellations captured in `ignoredNetworkFailures`.
- Kept the artifact `count` focused on true console/network failures, so ignored
  navigation cancels are audit evidence but do not inflate failure counts.
- Updated the Loops service Browser QA test fixture to prove ignored navigation
  cancels are persisted and reflected in the evidence artifact summary.

Validation:

- `pnpm --filter @repo/api exec jest src/modules/loops/loops.service.spec.ts --runInBand --testNamePattern='Browser QA'`
  passed: 1 suite, 2 matching tests.

Documentation update:

- UX-04 now records that ignored navigation-cancel counts are visible in both
  the issue detail QA artifact card and the evidence artifact summary.

Remaining review:

- Full browser E2E should confirm real route transitions produce ignored
  navigation-cancel evidence while true API failures still appear in
  `networkFailures`.

## Cycle 13 - SSO E2E Environment Preflight

Implementation:

- Added `apps/web/e2e/sso-e2e-env.ts` with reusable validation for Web/API/SSO
  origin alignment and expected OIDC callback URL derivation.
- Added unit coverage for aligned local E2E env and common mismatch cases:
  API origin drift, app base URL drift, frontend URL drift, and SSO tier drift.
- Wired the validator into `apps/web/e2e/sso-real.spec.ts` so real SSO E2E
  fails before browser login when local/test env variables are misaligned.

Validation:

- `pnpm --filter @repo/web test -- e2e/sso-e2e-env.test.ts --runInBand`
  passed: 12 suites, 78 tests.

Documentation update:

- BUG-01, BUG-02, and OPZ-02 now point to the SSO E2E preflight as the
  executable way to detect callback/origin alignment problems before attempting
  credential entry.

Remaining review:

- External SSO OAuth-client registration still needs to allow the callback URL
  reported by the preflight for the chosen local/test run.

## Cycle 14 - Documentation Deduplication and Test-Domain Boundary

Implementation:

- Removed the duplicate UX-04 next execution plan left after Browser QA
  navigation-cancel classification was implemented.
- Clarified BUG-04 so repository-local validation points to the executable
  local Web/API/SSO path and SSO E2E preflight, while
  `vibecoding.test.dofe.ai` remains an external deployment/release validation
  item.

Validation:

- `find docs/0629 -type f -maxdepth 2 -print0 | xargs -0 rg -n "Next execution plan:|Cycle 14|vibecoding.test|Status: Repository-side documentation"`
  confirmed each finding now has a single next execution plan and BUG-04 has a
  clarified repository/external boundary.

Documentation update:

- UX-04 and BUG-04 are now internally consistent with the implemented Browser QA
  classification and local SSO E2E preflight.

Remaining review:

- Test-domain route availability still needs deployment validation outside this
  repository.

## Cycle 15 - Final Code Review, Documentation Optimization, and Test Pass

Implementation:

- Re-ran a repository-owned review of `docs/0629` and the changed Loops issue
  intake/runtime/Browser QA surfaces.
- Updated this final review section so it reflects Cycle 11 through Cycle 15
  rather than the prior Cycle 6 through Cycle 10 stopping point.
- Preserved external/upstream residual items separately from repository-owned
  implemented work.

Validation:

- Web focused tests passed for issue intake, issue detail, dashboard runtime,
  favicon route, and SSO E2E env preflight.
- API focused tests passed for OIDC URL resolution, tenant issue persistence,
  Browser QA worker/report evidence, and runtime diagnostics.
- Contracts schema test, locale/Turbo JSON checks, and Web/API type-checks all
  passed.

Documentation update:

- Final review now lists the third-pass validation matrix and remaining
  external/upstream items.

Remaining review:

- The only remaining items require external SSO OAuth-client registration,
  Docker daemon/registry validation, test-domain deployment validation, or
  upstream `@dofe/infra-rabbitmq` changes.

## Cycle 16 - SSO Internal API Tier Preflight

Implementation:

- Extended the SSO E2E env preflight to validate `SSO_INTERNAL_API_URL` against
  the same local/test SSO origin as `NEXT_PUBLIC_SSO_BASE_URL`,
  `SSO_ISSUER`, and `SSO_API_URL`.
- Updated the SSO env validator tests so a mismatched internal API tier fails
  before browser login.

Validation:

- `pnpm --filter @repo/web test -- e2e/sso-e2e-env.test.ts --runInBand`
  passed: 12 suites, 78 tests.

Documentation update:

- BUG-02 and OPZ-02 now explicitly state that `SSO_INTERNAL_API_URL` is covered
  by the executable SSO E2E preflight.

Remaining review:

- External SSO OAuth-client registration is still required before real
  credential entry can complete.

## Cycle 17 - Docker Fallback Pull Readiness Verification

Implementation:

- Hardened `LoopsWorkspaceProfileService.pullImage` so runtime image preparation
  now has three explicit repository-side outcomes:
  - `already-present` when the Docker fallback image is inspectable before pull.
  - `pulled` only when pull succeeds and the image is inspectable afterward.
  - `failed` when pull reports success but the image is still not locally ready.
- Added service regression coverage for already-present images, successful
  post-pull readiness, post-pull-not-ready failures, and the existing
  non-throwing Docker failure path.

Validation:

- `pnpm --filter @repo/api exec jest libs/domain/services/loops-runtime/loops-workspace-profile.service.spec.ts libs/domain/services/loops-runtime/agent-runtime-detection.service.spec.ts --runInBand`
  passed: 2 suites, 12 tests.

Documentation update:

- OPZ-01 now records the service-level readiness hardening and keeps real
  daemon/registry validation as the remaining external verification step.

Remaining review:

- BUG-05 still needs an executable regression that protects the generated
  `apps/web/next-env.d.ts` format from reintroducing dev-server worktree noise.

## Cycle 18 - Next Env Generated-Format Regression

Implementation:

- Added `apps/web/__tests__/next-env-format.test.ts` to assert the committed
  `apps/web/next-env.d.ts` content matches the Next dev output observed during
  QA, including the double-quoted generated routes import.

Validation:

- `pnpm --filter @repo/web test -- __tests__/next-env-format.test.ts --runInBand`
  passed: 13 suites, 79 tests.

Documentation update:

- BUG-05 now records the executable regression and includes the new test in the
  follow-up validation scope.

Remaining review:

- UX-02 and UX-03 are implemented, but the issue-detail regression suite can
  still be strengthened around the default expanded/collapsed delivery-control
  states.

## Cycle 19 - Evidence-Bearing Detail Delivery Controls Regression

Implementation:

- Added an issue-detail regression that verifies evidence-bearing issues keep
  advanced delivery controls expanded by default, including Browser QA, second
  opinion, and release canary actions.
- Kept the existing fresh-issue regression intact, so the suite now protects
  both sides of the UX-03 rule: first-run pages are quieter, active delivery
  pages stay operator-ready.

Validation:

- `pnpm --filter @repo/web test -- 'app/loops/[issueId]/page.test.tsx' --runInBand`
  passed: 13 suites, 80 tests.

Documentation update:

- UX-03 now records the Cycle 19 complementary regression coverage.

Remaining review:

- One final implementation/review cycle remains: optimize the `docs/0629`
  status documents, run the focused validation matrix, and record any residual
  repository-owned or external items accurately.

## Cycle 20 - Documentation Optimization and Final Validation Pass

Implementation:

- Re-reviewed the `docs/0629` status documents after Cycles 16 through 19.
- Updated the final review section so the active close-out reflects this fourth
  pass: SSO internal API preflight, Docker fallback readiness hardening,
  `next-env.d.ts` generated-format regression, and evidence-bearing issue-detail
  delivery-control regression.
- Fixed the new `next-env.d.ts` regression test to import Vitest globals
  explicitly so the Web type-check includes it cleanly.
- Preserved external/upstream residual items separately from repository-owned
  implemented work.

Validation:

- See the final automated validation matrix below.

Documentation update:

- The final review now reflects Cycle 16 through Cycle 20 and includes the
  newly-added API/Web regression tests in the verification story.

Remaining review:

- No additional repository-owned implementation items were identified during
  this pass beyond the external/upstream validations listed below.

## Final Review and Test Pass

Code review result:

- Completed the requested fourth-pass implementation loop with five additional
  cycles: Cycle 16 through Cycle 20, building on the earlier Cycle 1 through
  Cycle 15 work.
- No blocking repository-owned issues remain in the implemented slices.
- Scope stayed inside Loops issue intake, issue detail UX, runtime fallback
  actions, Browser QA evidence, local/test SSO env guidance and preflight,
  contracts, and `docs/0629` status documents.

Automated validation:

- `pnpm --filter @repo/web test -- app/loops/new/simple-loop-issue-form.test.tsx app/loops/new/new-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx' app/loops/page.test.tsx app/favicon.ico/route.test.ts __tests__/next-env-format.test.ts e2e/sso-e2e-env.test.ts --runInBand`
  passed: 13 suites, 80 tests.
- `pnpm --filter @repo/api exec jest src/modules/oidc-client-api/url-resolver.spec.ts libs/domain/services/loops-issues/loops-issues.service.spec.ts libs/domain/services/loops-quality/loops-browser-qa-worker.service.spec.ts src/modules/loops/loops.service.spec.ts libs/domain/services/loops-runtime/loops-workspace-profile.service.spec.ts libs/domain/services/loops-runtime/agent-runtime-detection.service.spec.ts --runInBand --testNamePattern='Browser QA|tenant|OIDC|runtime status and diagnostics|pullImage|Docker|workspace|runtime'`
  passed: 6 suites, 31 matching tests.
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` passed:
  1 suite, 18 tests.
- `node -e "JSON.parse(require('fs').readFileSync('turbo.json','utf8')); for (const f of ['apps/web/locales/en/loops.json','apps/web/locales/zh-CN/loops.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"`
  passed.
- `pnpm --filter @repo/web type-check` passed.
- `pnpm --filter @repo/api type-check` passed.
- `find docs/0629 -type f -maxdepth 2 -print0 | xargs -0 rg -n "third-pass|Cycle 15 through|duplicate|Partially implemented|still require|still requires|Not implemented|Status:"`
  found only expected external/upstream residual items.

Residual external or upstream items:

- Real SSO account login for `13800138000` / tenant `优惠豚` still requires the
  external SSO OAuth client to allow the chosen callback URL, such as
  `http://127.0.0.1:13100/auth/oidc/callback`.
- Real Docker fallback readiness still needs a local Docker daemon/registry run
  to pull the Codex and Claude Code images and confirm runtime redetection.
- RabbitMQ credential-bearing startup logs and benign shutdown severity still
  originate from upstream `@dofe/infra-rabbitmq` and remain tracked in
  `docs/0629/opzs/agent-runtime-platform-optimizations.md`.

## Cycle 21 - Dashboard Docker Pull Failure Feedback

Implementation:

- Extended the Loops dashboard runtime image pull flow to read the
  `PullLoopImageResponse` body returned by the API.
- If the service reports `status: failed`, the dashboard now renders the
  returned message inline and does not trigger runtime redetection.
- Successful `pulled` and `already-present` responses still clear the inline
  error and retry runtime detection.

Validation:

- `pnpm --filter @repo/web test -- app/loops/page.test.tsx --runInBand`
  passed: 13 suites, 81 tests.

Documentation update:

- OPZ-01 now records the dashboard business-failure branch in addition to the
  service-level pull readiness hardening.

Remaining review:

- BUG-04 still has an external test-domain route gap; repository-side E2E can
  gain a cheap route preflight so this failure is reported before credential
  entry.

## Cycle 22 - SSO E2E Loops Route Preflight

Implementation:

- Added `expectedLoopsNewUrl` to the SSO E2E env helper.
- The real SSO Playwright flow now visits `/loops/new` before opening the login
  path and fails with an explicit message if the Loops intake route returns 404.
- Added a unit regression for the route URL helper.

Validation:

- `pnpm --filter @repo/web test -- e2e/sso-e2e-env.test.ts --runInBand`
  passed: 13 suites, 81 tests.

Documentation update:

- BUG-04 now records that repository-side SSO E2E has a Loops route preflight,
  while actual `vibecoding.test.dofe.ai` deployment remains external.

Remaining review:

- Real SSO/tenant validation still depends on external OAuth callback
  registration and a reachable target route, but the repo can further improve
  tenant pre-submit regression coverage for the full issue form.

## Cycle 23 - Tenant Snapshot Parser Hardening

Implementation:

- Added storage-level regression coverage for valid tenant snapshots, malformed
  snapshots with a legacy tenant-id fallback, and unusable tenant storage.
- Hardened `getCurrentTenantSnapshot` to accept only non-empty string tenant
  identifiers and optional string `tenantName` / `teamId` fields.
- Invalid browser storage can no longer inject non-string tenant context into
  full or simple issue submission payloads.

Validation:

- `pnpm --filter @repo/web test -- lib/storage/index.test.ts --runInBand`
  passed: 14 suites, 84 tests.

Documentation update:

- BUG-03 and UX-01 now record tenant snapshot parser hardening as repository-side
  protection while real SSO tenant membership validation remains external.

Remaining review:

- UX-02 is implemented in English copy tests, but the documented Chinese-locale
  human-gate validation still lacks a focused repository-side regression.

## Cycle 24 - Chinese Human-Gate Runtime Copy Regression

Implementation:

- Updated the issue-detail test harness so it can render with a caller-supplied
  locale and message catalog.
- Added a Chinese-locale regression for `PHASE_2_REVIEW` human-gated issue
  detail copy, covering `等待人工审阅`, `需要人工审阅`, and `批准后恢复`.

Validation:

- `pnpm --filter @repo/web test -- 'app/loops/[issueId]/page.test.tsx' --runInBand`
  passed: 14 suites, 85 tests.

Documentation update:

- UX-02 now records repository-side English and Chinese human-gate copy
  coverage.

Remaining review:

- One final cycle remains for document cleanup, stale-status review, and the
  focused validation matrix for Cycles 21 through 24.

## Cycle 25 - Current Status Consolidation and Final Validation

Implementation:

- Re-reviewed `docs/0629` after Cycles 21 through 24 and treated older
  `Remaining review` paragraphs as historical loop notes, not current blockers.
- Consolidated the current repository-owned status:
  - OPZ-01 now covers backend pull readiness and dashboard business-failure
    feedback.
  - BUG-04 now has an SSO E2E route preflight for `/loops/new`.
  - BUG-03 / UX-01 now include tenant snapshot parser hardening.
  - UX-02 now has English and Chinese human-gate copy regression coverage.
- Preserved the remaining non-repository blockers as external/upstream items:
  SSO OAuth callback/client registration, real test-domain deployment, real
  Docker daemon/registry validation, and upstream RabbitMQ logging behavior.

Validation:

- See the final validation matrix below.

Documentation update:

- This section is the current close-out state for the fifth-pass implementation
  loop, superseding older historical `Remaining review` notes in this file.

Remaining review:

- No new repository-owned implementation item was identified after this pass.

## Fifth-Pass Final Review and Test Pass

Code review result:

- Completed another requested five-cycle implementation loop: Cycle 21 through
  Cycle 25, building on Cycle 1 through Cycle 20.
- No blocking repository-owned issue remains in the implemented slices.
- Scope stayed inside Loops runtime fallback UX, SSO E2E preflight, tenant
  snapshot safety, issue-detail human-gate UX, and `docs/0629` status tracking.

Automated validation:

- `pnpm --filter @repo/web test -- app/loops/page.test.tsx e2e/sso-e2e-env.test.ts lib/storage/index.test.ts 'app/loops/[issueId]/page.test.tsx' app/loops/new/new-loop-issue-form.test.tsx app/loops/new/simple-loop-issue-form.test.tsx __tests__/next-env-format.test.ts --runInBand`
  passed: 14 suites, 85 tests.
- `pnpm --filter @repo/api exec jest libs/domain/services/loops-runtime/loops-workspace-profile.service.spec.ts libs/domain/services/loops-runtime/agent-runtime-detection.service.spec.ts src/modules/oidc-client-api/url-resolver.spec.ts libs/domain/services/loops-issues/loops-issues.service.spec.ts libs/domain/services/loops-quality/loops-browser-qa-worker.service.spec.ts src/modules/loops/loops.service.spec.ts --runInBand --testNamePattern='pullImage|Docker|runtime|OIDC|tenant|Browser QA|runtime status and diagnostics'`
  passed: 6 suites, 25 matching tests.
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` passed:
  1 suite, 18 tests.
- `node -e "JSON.parse(require('fs').readFileSync('turbo.json','utf8')); for (const f of ['apps/web/locales/en/loops.json','apps/web/locales/zh-CN/loops.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"`
  passed.
- `pnpm --filter @repo/web type-check` passed.
- `pnpm --filter @repo/api type-check` passed.

Residual external or upstream items:

- Real SSO account login for `13800138000` / tenant `优惠豚` still requires the
  external SSO OAuth client to allow the selected callback URL.
- `vibecoding.test.dofe.ai` still needs an external deployment/release check to
  serve `/loops/new`; the repository SSO E2E now fails early if it does not.
- Real Docker fallback readiness still needs a local Docker daemon/registry run.
- RabbitMQ credential-bearing startup logs and benign shutdown severity still
  originate from upstream `@dofe/infra-rabbitmq`.

## Current Final Close-Out

Latest completed loop:

- Cycle 36 through Cycle 40.
- Latest validation section: `Eighth-Pass Final Review and Test Pass`.

Repository-owned status:

- SSO preflight malformed URL handling is implemented and covered by executable
  Vitest tests under `apps/web/__tests__/sso-e2e-env.test.ts`.
- `/loops/new` tenant refresh is covered at storage-helper and hook-event
  levels.
- Docker fallback pull readiness now returns structured failures for post-pull
  inspect errors.
- Browser QA malformed worker output now becomes a readable blocked report.
- No repository-owned blocker remains from this pass.

Latest validation:

- Web focused matrix passed: 16 suites, 100 tests.
- API focused matrix passed: 6 suites, 27 matching tests.
- Contracts schema tests passed: 1 suite, 18 tests.
- JSON config/locale parse check passed.
- Web and API type-check passed.

Remaining external or upstream work:

- Real SSO account login for `13800138000` / tenant `优惠豚` still requires the
  external SSO OAuth client to allow the selected callback URL.
- `vibecoding.test.dofe.ai` still needs an external deployment/release check to
  serve `/loops/new`.
- Real Docker fallback readiness still needs a local Docker daemon/registry run.
- RabbitMQ credential-bearing startup logs and benign shutdown severity still
  originate from upstream `@dofe/infra-rabbitmq`.

## Latest Status Index

Current close-out:

- The latest completed implementation loop is Cycle 36 through Cycle 40.
- The latest final validation matrix is `Eighth-Pass Final Review and Test
Pass`.
- Historical `Remaining review` notes before Cycle 40 are superseded by the
  cycle that follows them unless they are repeated in the latest residual list.

Repository-owned status:

- SSO preflight, tenant browser-state refresh, Docker fallback pull readiness,
  and Browser QA diagnostics have focused regression coverage and passed the
  final validation matrix.
- No new repository-owned implementation blocker was identified in this pass.

External or upstream residuals:

- Real SSO account login for `13800138000` / tenant `优惠豚` still requires the
  external SSO OAuth client to allow the selected callback URL.
- `vibecoding.test.dofe.ai` still needs an external deployment/release check to
  serve `/loops/new`; repository SSO E2E now fails early on unusable route
  status.
- Real Docker fallback readiness still needs a local Docker daemon/registry run.
- RabbitMQ credential-bearing startup logs and benign shutdown severity still
  originate from upstream `@dofe/infra-rabbitmq`.

## Cycle 26 - Dashboard Docker Pull Request Error Feedback

Implementation:

- Added a dashboard regression for rejected Docker pull mutations.
- Updated the runtime image pull handler to catch request/API exceptions and
  render the error message inline beside the runtime card.
- Request errors now behave like business `failed` pull responses: no runtime
  redetection is triggered until the operator retries.

Validation:

- `pnpm --filter @repo/web test -- app/loops/page.test.tsx --runInBand`
  passed: 14 suites, 86 tests.

Documentation update:

- OPZ-01 now records dashboard request-error feedback in addition to business
  failure feedback.

Remaining review:

- SSO E2E route preflight still checks only 404; repository-side validation can
  make other non-2xx/non-3xx route responses fail before credential entry too.

## Cycle 27 - SSO E2E Route Status Preflight

Implementation:

- Added `isUsableLoopsRouteStatus` to the SSO E2E helper.
- Tightened the real SSO Playwright preflight so `/loops/new` must return a
  2xx/3xx response before the login flow proceeds.
- Added unit coverage for accepted route statuses and rejected missing,
  client-error, and server-error responses.

Validation:

- `pnpm --filter @repo/web test -- e2e/sso-e2e-env.test.ts --runInBand`
  passed: 14 suites, 86 tests.

Documentation update:

- BUG-04 now records that repository-side SSO E2E fails early on any unusable
  Loops intake route response, not only 404.

Remaining review:

- Tenant snapshot parsing is hardened, but storage setter coverage does not yet
  verify that clearing tenant state removes both legacy and snapshot keys.

## Cycle 28 - Tenant Snapshot Cleanup Regression

Implementation:

- Added Web storage regressions proving `clearCurrentTenantId` removes both
  `currentTenant` and `currentTenantSnapshot`.
- Added coverage that `clearAll` also clears the readable tenant snapshot along
  with the rest of the browser session state.

Validation:

- `pnpm --filter @repo/web test -- lib/storage/index.test.ts --runInBand`
  passed: 14 suites, 88 tests.

Documentation update:

- BUG-03 and UX-01 now record cleanup coverage for tenant snapshot state.

Remaining review:

- Browser QA navigation-cancel classification is covered in reports/evidence,
  but the exact ignored failure classification helper can still gain direct
  edge-case coverage for common browser cancellation strings.

## Cycle 29 - Browser QA Navigation-Cancel Classification Helper

Implementation:

- Extracted the Browser QA navigation-cancel classification pattern into an
  exported helper used by the worker script generation path.
- Added direct unit coverage for `ERR_ABORTED`, `AbortError`,
  `NS_BINDING_ABORTED`, `cancelled`, and `canceled`.
- Confirmed real connection/name failures are not ignored.

Validation:

- `pnpm --filter @repo/api exec jest libs/domain/services/loops-quality/loops-browser-qa-worker.service.spec.ts --runInBand`
  passed: 1 suite, 4 tests.

Documentation update:

- UX-04 now records direct helper coverage for ignored navigation-cancel noise.

Remaining review:

- Final cycle should consolidate Cycle 26 through Cycle 29 and rerun the focused
  validation matrix including Web, API, contracts, JSON, and type-checks.

## Cycle 30 - Sixth-Pass Documentation Optimization and Final Validation

Implementation:

- Re-reviewed the fifth-pass residual list and Cycles 26 through 29.
- Consolidated the sixth-pass repository-owned status:
  - OPZ-01 now handles dashboard Docker pull business failures and request
    exceptions inline.
  - BUG-04 now fails SSO E2E before login on any unusable `/loops/new` route
    status, not just 404.
  - BUG-03 / UX-01 now cover tenant snapshot parsing and cleanup.
  - UX-04 now has direct navigation-cancel classification helper coverage.
- Preserved the remaining external/upstream blockers separately.

Validation:

- See the sixth-pass final validation matrix below.

Documentation update:

- This section is the current close-out state for the sixth-pass implementation
  loop.

Remaining review:

- No new repository-owned implementation item was identified after this pass.

## Sixth-Pass Final Review and Test Pass

Code review result:

- Completed another requested five-cycle implementation loop: Cycle 26 through
  Cycle 30, building on Cycle 1 through Cycle 25.
- No blocking repository-owned issue remains in the implemented slices.
- Scope stayed inside Loops runtime fallback UX, SSO E2E route preflight,
  tenant browser-state safety, Browser QA noise classification, and `docs/0629`
  status tracking.

Automated validation:

- `pnpm --filter @repo/web test -- app/loops/page.test.tsx e2e/sso-e2e-env.test.ts lib/storage/index.test.ts 'app/loops/[issueId]/page.test.tsx' app/loops/new/new-loop-issue-form.test.tsx app/loops/new/simple-loop-issue-form.test.tsx __tests__/next-env-format.test.ts --runInBand`
  passed: 14 suites, 88 tests.
- `pnpm --filter @repo/api exec jest libs/domain/services/loops-quality/loops-browser-qa-worker.service.spec.ts libs/domain/services/loops-runtime/loops-workspace-profile.service.spec.ts libs/domain/services/loops-runtime/agent-runtime-detection.service.spec.ts src/modules/oidc-client-api/url-resolver.spec.ts libs/domain/services/loops-issues/loops-issues.service.spec.ts src/modules/loops/loops.service.spec.ts --runInBand --testNamePattern='classifyBrowserQaRequestFailure|pullImage|Docker|runtime|OIDC|tenant|runtime status and diagnostics'`
  passed: 6 suites, 24 matching tests.
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` passed:
  1 suite, 18 tests.
- `node -e "JSON.parse(require('fs').readFileSync('turbo.json','utf8')); for (const f of ['apps/web/locales/en/loops.json','apps/web/locales/zh-CN/loops.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"`
  passed.
- `pnpm --filter @repo/web type-check` passed.
- `pnpm --filter @repo/api type-check` passed.

Residual external or upstream items:

- Real SSO account login for `13800138000` / tenant `优惠豚` still requires the
  external SSO OAuth client to allow the selected callback URL.
- `vibecoding.test.dofe.ai` still needs an external deployment/release check to
  serve `/loops/new`; repository SSO E2E now fails early on unusable route
  status.
- Real Docker fallback readiness still needs a local Docker daemon/registry run.
- RabbitMQ credential-bearing startup logs and benign shutdown severity still
  originate from upstream `@dofe/infra-rabbitmq`.

## Cycle 36 - SSO Preflight Invalid URL Regression

Implementation:

- Added executable Web E2E env helper coverage for invalid URL values in SSO
  preflight inputs.
- The regression locks the expected operator-facing output for malformed
  `NEXT_PUBLIC_SERVER_BASE_URL` and `SSO_ISSUER` values before browser login.
- Moved helper unit coverage out of the Vitest-excluded `e2e` directory into
  `apps/web/__tests__/sso-e2e-env.test.ts`.
- Updated `validateSsoE2eEnv` to collect invalid URL values as readable
  preflight issues instead of throwing.

Validation:

- `pnpm --filter @repo/web test -- __tests__/sso-e2e-env.test.ts --runInBand`
  passed: 16 suites, 100 tests.

Documentation update:

- BUG-01 / BUG-02 now include malformed-URL preflight coverage in the
  repository-side validation story.

Remaining review:

- `/loops/new` tenant context still needed direct hook-level coverage for the
  browser events that update visible tenant state.

## Cycle 37 - Current Loop Tenant Hook Event Regression

Implementation:

- Added focused hook coverage for `useCurrentLoopTenant`.
- The tests verify the hook returns `undefined` without tenant context, refreshes
  on same-tab `currentTenantUpdated`, and refreshes on cross-tab `storage`
  events.

Validation:

- `pnpm --filter @repo/web test -- app/loops/new/use-current-loop-tenant.test.ts --runInBand`
  passed: 15 suites, 93 tests.

Documentation update:

- BUG-03 and UX-01 now record hook-level event coverage in addition to storage
  helper coverage.

Remaining review:

- Docker fallback pull already handled business failures, but post-pull image
  inspection exceptions could still surface as lower-level errors.

## Cycle 38 - Docker Pull Post-Inspect Failure Handling

Implementation:

- Added an API regression for `pullImage` when Docker pull succeeds but the
  post-pull local image inspection throws.
- Updated `LoopsWorkspaceProfileService.pullImage` to return a structured
  `failed` response with the message
  `Docker image pull finished, but readiness inspection failed.`

Validation:

- `pnpm --filter @repo/api exec jest libs/domain/services/loops-runtime/loops-workspace-profile.service.spec.ts --runInBand --testNamePattern='pullImage'`
  passed: 1 suite, 5 matching tests.

Documentation update:

- OPZ-01 now includes post-pull readiness inspection exception handling.

Remaining review:

- Browser QA worker output parsing still needed a clearer failure mode when the
  worker wrote malformed JSON shape.

## Cycle 39 - Browser QA Malformed Worker Output Guard

Implementation:

- Added an API regression where the Browser QA worker writes JSON missing
  required array fields.
- Added lightweight worker-output validation so malformed output becomes a
  `blocked` report with a readable `Browser QA worker output is malformed...`
  reason instead of a generic TypeError.

Validation:

- `pnpm --filter @repo/api exec jest libs/domain/services/loops-quality/loops-browser-qa-worker.service.spec.ts --runInBand --testNamePattern='malformed|navigation aborts|classifies|real request failures'`
  passed: 1 suite, 4 matching tests.

Documentation update:

- UX-04 now records malformed Browser QA worker output handling as a repository
  UX/diagnostic improvement.

Remaining review:

- Final cycle should consolidate Cycle 36 through Cycle 39 and rerun the focused
  validation matrix.

## Cycle 40 - Eighth-Pass Documentation Optimization and Final Validation

Implementation:

- Re-reviewed Cycle 36 through Cycle 39 and consolidated the current
  repository-owned status:
  - SSO E2E env preflight now covers aligned origins, mismatched tiers,
    expected callback derivation, usable route status, and malformed URL values.
  - `/loops/new` tenant state now has storage-helper and hook-level event
    coverage.
  - Docker fallback pull now returns structured outcomes for already-present,
    pulled, post-pull-not-ready, docker-client failure, and post-inspect
    exception paths.
  - Browser QA now has ignored navigation cancellation coverage, shared matcher
    source coverage, and malformed worker-output diagnostics.
- Preserved external/upstream blockers separately from repository-owned
  implementation state.

Validation:

- See the eighth-pass final validation matrix below.

Documentation update:

- This section is the current close-out state for the eighth-pass
  implementation loop. Older `Remaining review` entries are historical notes
  superseded by the latest cycle that follows them.

Remaining review:

- No new repository-owned implementation item was identified after this pass.

## Eighth-Pass Final Review and Test Pass

Code review result:

- Completed another requested five-cycle implementation loop: Cycle 36 through
  Cycle 40, building on Cycle 1 through Cycle 35.
- No blocking repository-owned issue remains in the implemented slices.
- Scope stayed inside Loops SSO preflight, tenant browser-state safety, Docker
  fallback readiness, Browser QA diagnostics, and `docs/0629` status tracking.

Automated validation:

- `pnpm --filter @repo/web test -- app/loops/page.test.tsx __tests__/sso-e2e-env.test.ts lib/storage/index.test.ts app/loops/new/use-current-loop-tenant.test.ts 'app/loops/[issueId]/page.test.tsx' app/loops/new/new-loop-issue-form.test.tsx app/loops/new/simple-loop-issue-form.test.tsx __tests__/next-env-format.test.ts --runInBand`
  passed: 16 suites, 100 tests.
- `pnpm --filter @repo/api exec jest libs/domain/services/loops-quality/loops-browser-qa-worker.service.spec.ts libs/domain/services/loops-runtime/loops-workspace-profile.service.spec.ts libs/domain/services/loops-runtime/agent-runtime-detection.service.spec.ts src/modules/oidc-client-api/url-resolver.spec.ts libs/domain/services/loops-issues/loops-issues.service.spec.ts src/modules/loops/loops.service.spec.ts --runInBand --testNamePattern='classifyBrowserQaRequestFailure|malformed|navigation aborts|pullImage|Docker|runtime|OIDC|tenant|runtime status and diagnostics'`
  passed: 6 suites, 27 matching tests.
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` passed:
  1 suite, 18 tests.
- `node -e "JSON.parse(require('fs').readFileSync('turbo.json','utf8')); for (const f of ['apps/web/locales/en/loops.json','apps/web/locales/zh-CN/loops.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"`
  passed.
- `pnpm --filter @repo/web type-check` passed.
- `pnpm --filter @repo/api type-check` passed.

Residual external or upstream items:

- Real SSO account login for `13800138000` / tenant `优惠豚` still requires the
  external SSO OAuth client to allow the selected callback URL.
- `vibecoding.test.dofe.ai` still needs an external deployment/release check to
  serve `/loops/new`; repository SSO E2E now fails early on unusable route
  status.
- Real Docker fallback readiness still needs a local Docker daemon/registry run.
- RabbitMQ credential-bearing startup logs and benign shutdown severity still
  originate from upstream `@dofe/infra-rabbitmq`.

## Cycle 31 - Docker Pull Retry Error-Clearing Regression

Implementation:

- Added a dashboard regression for the operator retry path after a Docker pull
  request error.
- The test proves a subsequent successful pull clears the previous inline error
  and triggers runtime redetection.
- No product code change was required; the existing success branch already
  removed per-runtime pull errors.

Validation:

- `pnpm --filter @repo/web test -- app/loops/page.test.tsx --runInBand`
  passed: 14 suites, 89 tests.

Documentation update:

- OPZ-01 now records retry error-clearing coverage for the Docker fallback UI.

Remaining review:

- SSO E2E route status helper can still document redirect acceptance explicitly
  in the bug list so test-domain deployers know 3xx is acceptable.

## Cycle 32 - SSO Route Redirect Acceptance Clarification

Implementation:

- Added an SSO E2E helper regression proving 302 route responses are accepted
  alongside 200 and 308.
- Clarified BUG-04 so test-domain deployers know `/loops/new` may return a
  usable 2xx page or expected 3xx auth redirect, while 4xx/5xx still fail before
  credential entry.

Validation:

- `pnpm --filter @repo/web test -- e2e/sso-e2e-env.test.ts --runInBand`
  passed: 14 suites, 89 tests.

Documentation update:

- BUG-04 next execution plan now distinguishes acceptable auth redirects from
  unusable route failures.

Remaining review:

- Tenant storage cleanup is covered, but `setCurrentTenantSnapshot` does not yet
  have a regression for dispatching the tenant update event consumed by
  `/loops/new`.

## Cycle 33 - Tenant Snapshot Update Event Regression

Implementation:

- Added Web storage regression coverage for the `currentTenantUpdated` event
  emitted by `setCurrentTenantSnapshot`.
- This protects the `/loops/new` live tenant confirmation path that listens for
  tenant changes in browser storage.

Validation:

- `pnpm --filter @repo/web test -- lib/storage/index.test.ts --runInBand`
  passed: 14 suites, 90 tests.

Documentation update:

- BUG-03 and UX-01 now record tenant snapshot event coverage in addition to
  parser and cleanup coverage.

Remaining review:

- Browser QA cancellation helper coverage exists, but the worker script path
  should explicitly use the helper source rather than duplicating a regex
  literal in the embedded script.

## Cycle 34 - Browser QA Cancellation Pattern Source Reuse

Implementation:

- Split the Browser QA navigation-cancel matcher into exported `source` and
  `flags` constants.
- The exported helper and embedded Playwright worker script now derive their
  regular expression from the same source metadata.
- This keeps Browser QA ignored-noise behavior aligned across unit helper tests
  and runtime script generation.

Validation:

- `pnpm --filter @repo/api exec jest libs/domain/services/loops-quality/loops-browser-qa-worker.service.spec.ts --runInBand`
  passed: 1 suite, 4 tests.

Documentation update:

- UX-04 now records that the worker script shares the helper pattern source.

Remaining review:

- Final cycle should consolidate Cycle 31 through Cycle 34 and rerun the focused
  validation matrix.

## Cycle 35 - Seventh-Pass Documentation Optimization and Final Validation

Implementation:

- Re-reviewed Cycle 31 through Cycle 34 and consolidated the current
  repository-owned status:
  - OPZ-01 now covers failed Docker pull display, request exception display, and
    successful retry error clearing.
  - BUG-04 route preflight now explicitly accepts 2xx and expected 3xx auth
    redirects while failing 4xx/5xx before login.
  - BUG-03 / UX-01 now cover tenant snapshot parsing, cleanup, and browser
    update event dispatch.
  - UX-04 now covers Browser QA cancellation helper behavior and embedded worker
    pattern-source reuse.
- Preserved external/upstream blockers separately.

Validation:

- See the seventh-pass final validation matrix below.

Documentation update:

- This section is the current close-out state for the seventh-pass
  implementation loop.

Remaining review:

- No new repository-owned implementation item was identified after this pass.

## Seventh-Pass Final Review and Test Pass

Code review result:

- Completed another requested five-cycle implementation loop: Cycle 31 through
  Cycle 35, building on Cycle 1 through Cycle 30.
- No blocking repository-owned issue remains in the implemented slices.
- Scope stayed inside Loops runtime fallback UX, SSO E2E route preflight,
  tenant browser-state safety, Browser QA noise classification, and `docs/0629`
  status tracking.

Automated validation:

- `pnpm --filter @repo/web test -- app/loops/page.test.tsx e2e/sso-e2e-env.test.ts lib/storage/index.test.ts 'app/loops/[issueId]/page.test.tsx' app/loops/new/new-loop-issue-form.test.tsx app/loops/new/simple-loop-issue-form.test.tsx __tests__/next-env-format.test.ts --runInBand`
  passed: 14 suites, 90 tests.
- `pnpm --filter @repo/api exec jest libs/domain/services/loops-quality/loops-browser-qa-worker.service.spec.ts libs/domain/services/loops-runtime/loops-workspace-profile.service.spec.ts libs/domain/services/loops-runtime/agent-runtime-detection.service.spec.ts src/modules/oidc-client-api/url-resolver.spec.ts libs/domain/services/loops-issues/loops-issues.service.spec.ts src/modules/loops/loops.service.spec.ts --runInBand --testNamePattern='classifyBrowserQaRequestFailure|pullImage|Docker|runtime|OIDC|tenant|runtime status and diagnostics'`
  passed: 6 suites, 24 matching tests.
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` passed:
  1 suite, 18 tests.
- `node -e "JSON.parse(require('fs').readFileSync('turbo.json','utf8')); for (const f of ['apps/web/locales/en/loops.json','apps/web/locales/zh-CN/loops.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"`
  passed.
- `pnpm --filter @repo/web type-check` passed.
- `pnpm --filter @repo/api type-check` passed.

Residual external or upstream items:

- Real SSO account login for `13800138000` / tenant `优惠豚` still requires the
  external SSO OAuth client to allow the selected callback URL.
- `vibecoding.test.dofe.ai` still needs an external deployment/release check to
  serve `/loops/new`; repository SSO E2E now fails early on unusable route
  status.
- Real Docker fallback readiness still needs a local Docker daemon/registry run.
- RabbitMQ credential-bearing startup logs and benign shutdown severity still
  originate from upstream `@dofe/infra-rabbitmq`.

## Current Final Close-Out

Latest completed loop:

- Cycle 36 through Cycle 40.
- Latest validation section: `Eighth-Pass Final Review and Test Pass`.

Repository-owned status:

- SSO preflight malformed URL handling is implemented and covered by executable
  Vitest tests under `apps/web/__tests__/sso-e2e-env.test.ts`.
- `/loops/new` tenant refresh is covered at storage-helper and hook-event
  levels.
- Docker fallback pull readiness now returns structured failures for post-pull
  inspect errors.
- Browser QA malformed worker output now becomes a readable blocked report.
- No repository-owned blocker remains from this pass.

Latest validation:

- Web focused matrix passed: 16 suites, 100 tests.
- API focused matrix passed: 6 suites, 27 matching tests.
- Contracts schema tests passed: 1 suite, 18 tests.
- JSON config/locale parse check passed.
- Web and API type-check passed.

Remaining external or upstream work:

- Real SSO account login for `13800138000` / tenant `优惠豚` still requires the
  external SSO OAuth client to allow the selected callback URL.
- `vibecoding.test.dofe.ai` still needs an external deployment/release check to
  serve `/loops/new`.
- Real Docker fallback readiness still needs a local Docker daemon/registry run.
- RabbitMQ credential-bearing startup logs and benign shutdown severity still
  originate from upstream `@dofe/infra-rabbitmq`.
