# Issue And Runtime E2E UI/UX Review

Date: 2026-07-12

## Implementation Status

- Cycle 1 completed: the requested OAuth scope set is now resolved from
  `SSO_SCOPES`, validated locally, and covered by API unit tests.
- The external `sso.ixicai.cn` OAuth client must still allow the configured scopes before
  the requested `优惠豚` account can complete a real authorization flow. This
  is an external configuration dependency, not a completed product test.

## Test Boundary

- Requested account: `13800138000`
- Requested tenant: `优惠豚`
- Real SSO used: `https://sso.ixicai.cn/api`
- Real browser flow reached the configured callback, but SSO returned
  `invalid_scope` before the application could establish a tenant session.
- A separate controlled API-bypass browser flow verified the product path:
  readable `优惠豚` context, issue creation, `Continue Loop` to spec review,
  and the Agent Runtime panel on `/loops`.

## UX-01: OAuth Scope Rejection Leaves The User On A Persistent Loading Screen

Observed:

- The SSO callback returned `invalid_scope` with a message that the requested
  scope is not allowed for the client.
- The browser remained on the localized `Completing sign-in...` state until the
  Playwright timeout instead of showing a recoverable authorization error.

Impact:

- A user cannot distinguish an SSO client-policy problem from a slow login.
- QA cannot reach tenant `优惠豚`, issue submission, or runtime through the
  requested account despite a valid callback URL.

Implementation status: in progress. Cycle 2 made the browser E2E recognize the
terminal success/error page correctly; Cycle 3 will add a dedicated regression
for the visible OAuth error state.

Cycle 2 update: completed. The test now treats only callback routes as pending
and asserts a terminal OAuth error before checking local tokens, so
`invalid_scope` fails immediately and with the correct cause.

Cycle 3 update: completed. The success page renders a localized retry state
for an OAuth failure, does not expose the raw SSO error description, and has a
component regression proving that the completion spinner is absent. A real
tenant success remains blocked by DEP-01 rather than this UI behavior.

Cycle 5 update: completed. The execution-plan checker now includes
`docs/0712`, and `pnpm quality:gate` passed after all repository-owned fixes.
The only remaining acceptance step is the external DEP-01 scope allowlist and
the resulting real browser test.

Cycle 6 update: completed. `SSO_SCOPES` now requires both `openid` and
`tenant`, preventing configuration from silently removing the tenant context
required by this review.

Cycle 8 update: completed. OAuth callback logs now retain the stable provider
error code and a description-presence signal only; raw provider descriptions
remain confined to the redirect path and are not rendered by the frontend.

Cycle 9 update: completed. Every recorded 0712 implementation cycle now has
machine-checked Implementation, Validation, and Docs evidence markers.

Cycle 10 update: completed. A second deep review fixed the tenant-scope
invariant, the Runtime anchor, and callback-log redaction; focused API/Web
regressions and `pnpm quality:gate` pass. Real acceptance remains external to
this repository until `sso.ixicai.cn` approves the required client scopes.

Scope alignment update: `../models.dofe.ai` issues the fixed scope set
`openid profile email tenant offline_access`. Vibecoding now declares that
same set explicitly in its `sso.ixicai.cn` API environment, while retaining
local validation that prevents omission of `openid` or `tenant`.

## UX-02: Agent Runtime Deep Link Was Parsed As An Issue ID

Observed:

- `/loops/agent-runtime` had no static page, so the dynamic
  `/loops/[issueId]` route could load it as an issue named `agent-runtime`.

Implementation status: completed in Cycle 4. The static route now redirects to
`/loops#agent-runtime`; Cycle 7 added the matching dashboard section anchor.
Its focused route and dashboard regressions plus web type-check pass.

Next execution plan:

- 目标: Keep runtime links pointed at the dashboard runtime anchor.
- 范围: Use `/loops/agent-runtime` only as the compatibility deep link and
  verify it after any routing or localization changes.
- 不做: Do not add a second runtime dashboard, expose issue-specific data, or
  change the `/loops/[issueId]` contract.
- 受益: Operators can use a stable bookmark while runtime state stays in one
  maintained interface.

## Follow-up Review Findings

- `SSO_SCOPES` now requires `openid` and `tenant`; this prevents tenant context
  from disappearing through an otherwise valid client-specific override.
- The Runtime compatibility route now has a matching `agent-runtime` dashboard
  anchor, not merely a redirect string.
- OAuth callback logs retain an error code and description-presence signal but
  no longer retain raw provider descriptions.

Next execution plan:

- 目标: Render a clear, localized OAuth failure state immediately after SSO
  rejects authorization.
- 范围: Preserve `error` and `error_description` through the callback redirect,
  display a non-sensitive explanation plus retry action on the success page,
  and add a browser regression for `invalid_scope`.
- 不做: Do not display authorization codes, tokens, client secrets, or raw SSO
  stack traces.
- 受益: Users and operators can identify a client-policy failure without
  waiting for a generic completion timeout.

## DEP-01: SSO Client Scope Allowlist

Observed:

- The application previously always requested
  `openid profile email tenant offline_access`, leaving no way to match the
  scope policy of a registered OAuth client.
- Cycle 1 added validated `SSO_SCOPES` configuration. An absent value keeps the
  prior complete default; an explicit value must include `openid` and `tenant`,
  contains no duplicate tokens, and uses conservative token characters.

Implementation status: repository work completed; external SSO allowlist
change remains pending.

Next execution plan:

- 目标: Align the `sso.ixicai.cn` OAuth client's allowed scopes with the approved
  `SSO_SCOPES` value and prove login for `优惠豚`.
- 范围: Update the client registration in `sso.ixicai.cn`, deploy only the
  approved environment configuration, then run the real browser SSO test.
- 不做: Do not weaken tenant authorization, remove `openid`, or put client
  secrets into documentation, browser output, or source control.
- 受益: The app can request only scopes the client is permitted to use while
  preserving a reproducible tenant-login test.

## Positive Coverage

- The controlled product flow showed the intended `优惠豚` tenant context before
  submission and again on issue detail.
- `Continue Loop` created the first spec and reached human review.
- The dashboard Agent Runtime section rendered the active agent state without
  browser page errors.

## Real Browser Retest - 2026-07-12

The requested real-account test used the `sso.ixicai.cn` flow with account
`13800138000` and the configured `vibecoding.local.dofe.ai` callback.

- HTTPS Web/API entry checks passed; the API CORS preflight accepted the Web
  origin.
- `sso.ixicai.cn` completed credential entry but redirected with
  `invalid_scope` for `openid profile email tenant offline_access`.
- The corrected callback page rendered a localized recovery state and retry
  action. It did not display the provider description or remain on the
  completion spinner.
- The test could not establish a tenant session, so `优惠豚` context, real Issue
  submission, Continue Loop, and real Agent Runtime could not be marked passed.

Next execution plan:

- 目标: Re-run the requested account-and-tenant workflow after the OAuth client
  scope policy is corrected in `sso.ixicai.cn`.
- 范围: Verify sign-in, `优惠豚` context on intake and detail, issue creation,
  Continue Loop, and `/loops/agent-runtime` with the real account.
- 不做: Do not substitute auth bypass evidence for this acceptance run or mark
  downstream product steps passed before a tenant session exists.
- 受益: Produces direct evidence for the exact customer path instead of relying
  on controlled test identities.
