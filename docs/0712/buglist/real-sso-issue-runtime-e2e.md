# Real SSO Issue And Runtime Bug List

Date: 2026-07-12

## BUG-01: OAuth Client Rejects The Required Tenant Workflow Scopes

Severity: P0

Status: open - external client-policy dependency

Observed in a real isolated browser run:

- The configured `sso.ixicai.cn` authorization request used
  `openid profile email tenant offline_access` and the configured browser
  callback.
- After credential entry, `sso.ixicai.cn` redirected with `invalid_scope`.
- No `/auth/oidc/exchange` request occurred, which is expected because no
  authorization code was issued.
- No tenant session was established. `优惠豚`, Issue submission, Continue Loop,
  and Agent Runtime could therefore not be tested with the requested account.

Business impact:

- The primary account cannot enter the issue-to-runtime workflow, despite the
  Web/API HTTPS paths and callback route being reachable.

Next execution plan:

- 目标: Allow the registered Vibecoding OAuth client to obtain the scopes needed
  for tenant-governed sign-in.
- 范围: In `sso.ixicai.cn`, allowlist `openid profile email tenant offline_access`
  for `vibecoding-dofe-ai-techwu-dev`, retain the exact callback URI, then rerun
  the real account flow through Issue creation and Agent Runtime.
- 不做: Do not remove `tenant`, use wildcard scopes, bypass SSO, or expose
  credentials, authorization codes, refresh tokens, or provider payloads.
- 受益: Restores the requested account's end-to-end product access and makes
  tenant-scoped loop evidence reproducible.
