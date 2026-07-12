# UI/UX Follow-up Next Steps

Status: external dependency only

Latest real-browser attempt: `sso.ixicai.cn` returned `invalid_scope` after
credential entry. The application now displays a recoverable error state, but
the requested tenant workflow remains blocked until BUG-01 is resolved.

All repository-owned implementation from both 2026-07-12 review passes has
completed and passed `pnpm quality:gate`. The remaining acceptance condition
depends on the `sso.ixicai.cn` OAuth client policy; it cannot be completed or
simulated from this repository without `sso.ixicai.cn` allowlisting the
requested scopes.

## DEP-01 - Approve Scopes And Rerun Real Tenant Flow

Next execution plan:

- 目标: Authorize the configured `SSO_SCOPES` for
  `vibecoding-dofe-ai-techwu-dev` and complete real-browser acceptance with
  account `13800138000` in tenant `优惠豚`.
- 范围: `sso.ixicai.cn` updates the OAuth client allowlist; the application
  environment uses `openid profile email tenant offline_access`, matching
  `../models.dofe.ai`; QA runs real login, tenant
  selection/context, issue creation, Continue Loop, and the Agent Runtime
  dashboard checks.
- 不做: Do not add a local auth bypass to acceptance evidence, reduce tenant
  permissions, expose credentials, or change the application's validated scope
  parsing to accommodate an unapproved policy. Do not remove required `openid`
  or `tenant` scopes.
- 受益: Produces the final production-like proof that the requested account and
  tenant can traverse the complete issue-to-runtime workflow.
