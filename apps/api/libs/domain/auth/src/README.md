# Auth Module

Vibecoding uses an authenticated-user access model.

- `@Auth()` verifies the SSO-backed session and supplies the request identity.
- Every authenticated user can access all Vibecoding pages and execute all
  product operations.
- `@RequireSuperAdmin()` and module permission decorators remain as legacy
  metadata for route compatibility, but `PermissionGuard` does not evaluate
  them or make SSO permission lookups.
- `SsoScopeService` assigns a selected workspace namespace, or a stable
  personal workspace when none is selected. It is data grouping, not access
  control.

Unauthenticated requests continue to receive `401 Unauthorized`.
