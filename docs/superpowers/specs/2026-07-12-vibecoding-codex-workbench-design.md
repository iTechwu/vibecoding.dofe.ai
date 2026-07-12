# Vibecoding Codex Workbench Redesign

## Status

Approved design direction: Codex-style workbench with a compact management
surface. Scope includes every authenticated web page. The login and OAuth
recovery pages remain outside the workbench.

## Problem

The authenticated experience currently has two competing shells: localized
routes provide a generic sidebar while the Loop dashboard renders its own
full-screen workbench. The dashboard exposes task work, approvals, runtime
health, policies, benchmarks, and diagnostics in one long page. A user who
wants to continue a loop cannot reliably distinguish the next product action
from operator-only controls.

## Goals

- Make `Continue Loop`, reviewing a decision, and creating an issue the most
  direct paths from every authenticated page.
- Establish one responsive application shell for all localized authenticated
  routes.
- Preserve existing Loop APIs, permissions, tenant context, SSO behavior,
  locale routing, and state-machine semantics.
- Keep management visibility available without making it the default task UI.

## Non-goals

- No API, database, auth, or Loop-engine contract changes.
- No new tenant-switching or workspace-membership workflow.
- No replacement for the existing evidence, runtime, or governance data; this
  work changes its presentation and information hierarchy only.

## Information Architecture

The authenticated shell has five destinations and a persistent creation action:

| Destination | Path                   | Primary job                         | Includes                                                   |
| ----------- | ---------------------- | ----------------------------------- | ---------------------------------------------------------- |
| Home        | `/`                    | Resume meaningful work              | Continue card, approvals requiring the user, recent issues |
| Issues      | `/loops`               | Find and manage loops               | Search, filters, active queue, compact status list         |
| Review      | `/loops#review-inbox`  | Resolve human gates                 | Review inbox and decision context                          |
| Runtime     | `/loops#agent-runtime` | Operate agents and inspect health   | Agent status, runtime readiness, exceptions                |
| Settings    | `/settings`            | Account and application preferences | Language, account, workspace context where available       |

`New Issue` is a high-emphasis sidebar action that opens `/loops/new`.
Issue detail remains `/loops/[issueId]` and is the place where a user advances
the Loop. Existing compatibility navigation to `/loops/agent-runtime` keeps
redirecting to the Runtime anchor.

## Shell And Visual System

- Use a dark, neutral, compact workbench by default: near-black canvas,
  restrained raised surfaces, muted borders, white primary text, and semantic
  green/amber/red status only when status carries meaning.
- The desktop sidebar contains the product mark, `New Issue`, destination
  navigation, then settings and the account menu. It supports an icon-only
  collapsed state. On narrow screens it becomes a dismissible drawer.
- The top bar exposes the current destination, compact search/command affordance,
  locale control, and account menu. It does not repeat product navigation.
- Preserve the existing Geist typefaces, 4px spacing rhythm, keyboard focus
  indication, localization, and shadcn UI primitives.
- Avoid dashboard-card sprawl: pages use restrained full-width sections; cards
  are reserved for compact task rows, status summaries, and framed controls.

## Page Behavior

### Home

Home replaces the template landing page after authentication. It prioritizes:

1. A single "continue" item with the next product-level action.
2. A compact approval queue for human-gated work.
3. Recent issues with phase, owner, and updated time.

Operational health, rules, benchmarks, and raw activity do not appear by
default. They remain accessible from Runtime or the issue detail evidence view.

### Issues

The current Loop dashboard becomes the canonical Issue and management surface.
Its default view shows active work and decision blockers first. Existing
operator data is retained in secondary management sections or panels so that
diagnostics remain available without dominating task work.

### New Issue

Use a focused composer: request text first, then compact workspace/template
controls, tenant confirmation, and a transparent normalized preview. Advanced
overrides remain disclosed on demand. Submission behavior, validation, and
redirect to issue detail do not change.

### Issue Detail

The header fixes task identity, phase, and the primary `Continue Loop` action.
The body groups content into Overview, Plan, Execution, and Evidence. The next
action and any human gate stay visible; detailed logs, runtime diagnostics,
governance controls, and delivery evidence are grouped behind the relevant
section rather than competing on initial load.

### Review And Runtime

Review is a focused queue rather than a duplicate dashboard. Runtime is the
operator view for agent availability, health, security exceptions, and related
diagnostics. Both retain their existing API-backed data and deep-link anchors.

### Settings

Replace the current redirect with a real shell page. It provides only account,
locale, and contextual application settings that already exist in the client;
it does not add server-side preference storage in this redesign.

## States And Accessibility

- Each destination renders a readable loading skeleton, recoverable error
  state, and empty state without hiding the primary navigation.
- All actions have visible labels or accessible names, keyboard focus, and a
  non-color status cue.
- Layouts work at 320px, 768px, 1024px, and 1440px. Action labels wrap or move
  below controls instead of overflowing.
- Existing tenant context remains visible before issue submission and in issue
  detail. No tenant identifier is exposed where it was not already available.

## Implementation Boundaries

- Extract shared shell navigation into focused components; do not create one
  new mega-component.
- Reuse existing Loop query hooks and dashboard model helpers. No raw HTTP
  calls are introduced.
- Preserve existing public test identifiers, anchor IDs, and compatibility
  routes where tests or bookmarks depend on them.
- Update affected English and Simplified Chinese translation resources together.

## Acceptance Criteria

- Every localized authenticated route uses the same sidebar/topbar shell.
- `/` is a useful home workbench, not the scaffold landing page.
- Users can reach New Issue, Issues, Review, Runtime, and Settings in one
  navigation interaction from any authenticated screen.
- `Continue Loop`, tenant context, issue creation, issue detail, Review, and
  Runtime remain functional with their existing data contracts.
- Management data remains reachable while the default Issues screen is
  materially shorter and task-focused.
- Focused unit tests, web type checking, linting, and browser checks pass for
  the redesigned flows.

## Risks And Mitigations

| Risk                                                                   | Mitigation                                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Existing dashboard page is large and has broad test coverage           | Preserve its query/model layer and extract presentation incrementally.                                        |
| Bookmarks and E2E rely on anchors                                      | Keep `review-inbox` and `agent-runtime` IDs and compatibility redirects.                                      |
| Current worktree contains unrelated authentication and runtime changes | Touch only web-shell, post-login route, translation, and focused test files; stage only redesign-owned files. |
| Dense operator data becomes hard to find                               | Retain it under Runtime/secondary panels with deep-linkable headings.                                         |
