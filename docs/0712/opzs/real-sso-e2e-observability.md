# Real SSO E2E Observability Optimizations

Date: 2026-07-12

## OPZ-01: Distinguish Authorization Rejection From Token Exchange Failure

Observed:

- The original browser test treated a terminal callback page as sufficient to
  proceed, then reported a missing local token.
- In the real run, `invalid_scope` means no authorization code and therefore no
  exchange request should exist. Treating this as a token failure hid the
  actionable cause.

Implemented:

- The E2E flow now records only safe terminal signals: OAuth error codes and
  `/auth/oidc/exchange` response statuses.
- It fails directly on an OAuth error before asserting token/refresh/upload
  behavior, and deduplicates repeated route-level observations.

Next execution plan:

- 目标: Make client scope-policy drift visible before a full browser run when
  the SSO platform exposes approved client metadata.
- 范围: Evaluate a non-secret `sso.ixicai.cn` client-metadata or registration
  check; if available, compare approved scopes with `SSO_SCOPES` in CI.
- 不做: Do not call token endpoints with test credentials during preflight, log
  client secrets, or infer allowlists from OIDC discovery alone.
- 受益: Operators receive a precise configuration failure before entering
  credentials and avoid misleading downstream E2E errors.
