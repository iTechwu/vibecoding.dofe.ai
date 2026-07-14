# VibeCoding Authenticated Workbench Design

## Status

Approved through visual review on 2026-07-14. This specification supersedes
the visual-system and default-navigation decisions in
`2026-07-12-vibecoding-codex-workbench-design.md`; its API, tenant, SSO, and
Loop-engine boundaries remain unchanged.

## Decision Summary

The authenticated product adopts a Codex-inspired workbench without copying
Codex branding or interface chrome.

1. **S1: workspace-first sidebar.** A visible workspace list is the primary
   navigation context. Core task actions are above it; settings and operations
   live under `More`.
2. **B2: delivery-tracking context.** The task conversation remains central
   while a right rail shows delivery phase, test result, and code-change
   summary.
3. **H1 + H3: resume plus inbox home.** Home has exactly one highest-priority
   `Continue Loop` action, followed immediately by an actionable task inbox.

## Evidence And Design Hypothesis

The redesign is grounded in four repository and review signals:

1. The current authenticated shell has a generic project group while the
   existing Loop page carries a separate, dense workbench.
2. The Loop surface combines task work, human review, runtime health, policy,
   benchmark, and diagnostic sections in one route.
3. The existing client already exposes the needed presentation data: Loop list,
   review inbox, agent runtime, issue detail, and configured workspaces. No
   additional service contract is required for the first implementation.
4. The approved visual comparison selected project-oriented navigation,
   persistent delivery visibility, and a home that supports both resuming and
   scanning work.

**Hypothesis:** A workspace-first, conversation-centered application shell
will let Loop owners resume, create, review, and inspect delivery work with
less navigation than the current dashboard, while keeping operator evidence
one deliberate interaction away.

## Audience And Core Journeys

| Persona    | Goal                           | Primary journey                                  | Failure to prevent                            |
| ---------- | ------------------------------ | ------------------------------------------------ | --------------------------------------------- |
| Loop owner | Move a request toward delivery | Home -> Continue Loop -> Issue detail -> action  | Losing the next action among diagnostics      |
| Reviewer   | Resolve a human gate           | Home inbox or Review -> Issue detail -> decision | Missing a waiting decision                    |
| Operator   | Diagnose execution             | More -> Runtime -> linked Issue                  | Management data disappearing from the product |

### Resume A Loop

```text
Sign in
  -> Home highlights one continuation and an ordered task inbox
  -> Continue Loop opens the issue in its current delivery stage
  -> The issue page exposes one product-level action and delivery tracking
  -> A completed action updates phase, evidence, and the home inbox
```

### Create A Loop From Conversation

```text
Select New Task or open a workspace conversation
  -> Write a request in the composer
  -> Existing simple-intake mutation creates an Issue
  -> The conversation shows the created Issue and delivery state
  -> Select the Issue to inspect or continue it
```

### Runtime Failure

```text
Runtime query fails
  -> Shell and current task stay available
  -> Runtime view shows a readable inline error and existing retry action
  -> The issue context states that runtime data is unavailable
  -> No management control is presented as successful until the query recovers
```

## Product Principles

1. **One task, one next action.** A Loop advances through a product-level
   action, not an exposed internal orchestration stage.
2. **Conversation creates accountable work.** A request becomes an Issue, not
   an untracked chat message.
3. **Workspace gives work its place.** The user can scan and switch configured
   workspaces without turning the sidebar into an Issue tree.
4. **Evidence is present, operations are secondary.** Delivery signals stay
   visible in context; governance and raw diagnostics are reachable but never
   dominate the default task screen.
5. **Density supports scanning.** Use border-separated rows and compact tool
   surfaces instead of unrelated decorative cards.

## Information Architecture

| Destination | Canonical path                         | Primary job                               | First viewport                            |
| ----------- | -------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| Home        | `/`                                    | Resume and triage work                    | One continuation plus ordered task inbox  |
| Workspace   | `/loops`                               | Hold task conversations and create Issues | Conversation history and request composer |
| Scheduled   | `/loops` with a task-list view         | Scan and act on all work                  | Actionable Issue rows                     |
| Review      | `/loops?view=operations#review-inbox`  | Resolve human decisions                   | Decision queue                            |
| Runtime     | `/loops?view=operations#agent-runtime` | Inspect agent and environment health      | Agents, environment, exceptions           |
| Settings    | `/settings`                            | Account, language, workspace context      | Client-visible preferences and context    |

`New Task` is a persistent primary action. It opens the conversation composer
when a workspace is available and otherwise retains the existing `/loops/new`
intake route. `/loops/agent-runtime` remains a compatibility redirect.

## Shell Specification

### Desktop

```text
+--------------------+-----------------------------------+------------------+
| VibeCoding          | Page / current workspace / search  | Task context     |
| [+ New Task]        +-----------------------------------+ phase progress   |
| Home                |                                   | tests            |
| Scheduled           |        page or conversation        | change summary   |
| Search              |                                   |                  |
|                    |                                   |                  |
| Workspaces          |                                   |                  |
|  - selected         |                                   |                  |
|  - available        |                                   |                  |
|                    |                                   |                  |
| More                |                                   |                  |
| Account             |                                   |                  |
+--------------------+-----------------------------------+------------------+
```

- The sidebar is 240px expanded and icon-only when collapsed. It contains the
  product name, `New Task`, Home, Scheduled, Search, the workspace list, then
  `More` and account controls at the bottom.
- The header is 52px high. It shows the destination or current workspace on
  the left, and team, locale, and account controls on the right. It does not
  repeat sidebar destinations.
- `More` contains Runtime, Operations, and Settings. It is a named menu, not
  an unlabeled icon.
- The task-context rail is 288px wide on desktop. It is visible on an active
  Issue and workspace conversation, and hidden on overview-only pages unless a
  contextual selection exists.

### Responsive Behavior

| Viewport         | Behavior                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 320px to 767px   | Sidebar becomes the current dismissible drawer. The task rail becomes a button that opens a sheet below the conversation header. Primary actions are full-width where needed. |
| 768px to 1023px  | Sidebar can remain expanded. Task rail moves below main content or opens as a sheet; no horizontal page overflow is allowed.                                                  |
| 1024px and above | Sidebar remains pinned. Conversation/issue pages use a fluid main column plus the 288px task rail.                                                                            |
| 1440px and above | Main content uses a readable maximum width; excess space remains whitespace rather than creating additional columns.                                                          |

## Visual System

The default is a calm light workbench that follows the approved visual
direction: a subtle neutral-green sidebar, white working canvas, restrained
borders, and high-contrast typography. System dark mode may map the same
semantic roles later, but is not the default design requirement.

| Token role     | Default value | Usage                                         |
| -------------- | ------------- | --------------------------------------------- |
| Canvas         | `#ffffff`     | Main work surface                             |
| Sidebar        | `#eef0e9`     | Persistent workspace navigation               |
| Subtle surface | `#f7f7f5`     | Selected/hovered low-emphasis content         |
| Border         | `#dfe2da`     | Dividers and controls                         |
| Foreground     | `#24272b`     | Primary text and iconography                  |
| Muted          | `#6e7176`     | Metadata and descriptions                     |
| Action         | `#24272b`     | Primary action surface; text remains explicit |
| Success        | `#159947`     | Passed and ready state with label             |
| Warning        | `#a16207`     | Waiting/review state with label               |
| Danger         | `#c2410c`     | Blocked/failed state with label               |

- Use the existing Geist typefaces and 4px spacing rhythm.
- Buttons and inputs use 6px radius; framed tools and context panels use 8px.
- No gradients, decorative glows, bokeh, or marketing hero treatment appear
  inside the authenticated product.
- Every status pairs color with text and, where helpful, a familiar icon.

## Screen Specifications

### Home: Resume Plus Inbox

Home is the default authenticated route. Its top section has one continuation
only: title, current phase, concise evidence summary, and `Continue Loop`.
Below it, `Scheduled` is a border-separated list sorted by the next useful
human action: awaiting review, active work, ready work, then paused work.

The home composer is always present below the inbox. It creates a new Issue
through the existing simple-intake path. Empty state replaces continuation and
inbox with a short explanation and the same composer; it does not show
operational metrics.

### Workspace: Conversation And Creation

`/loops` is the collaboration surface. Each submitted request creates an
Issue. Conversation turns show the request, Issue title, delivery status, and
a link to its detail page. Selecting a task loads its delivery context in the
right rail: stage track, environment, test result, and diff summary.

The composer remains sticky at the bottom, supports Enter to submit and
Shift+Enter for line breaks, and gives a readable error without clearing the
draft. Workspace selection scopes what is shown in the sidebar and task
context, but does not introduce a new persistence contract.

### Scheduled And Search

Scheduled is a compact Issue list with a visible search affordance and filters
that reuse current list capabilities. Rows expose title, workspace when
available, phase, next action, owner, and updated time. Search is a command
affordance in the header and links to existing task, review, runtime, and
creation destinations; it is not a new global backend search service.

### Issue Detail

Issue detail has a page header rather than a card: breadcrumb, issue title,
phase, status, tenant context, and the existing `Continue Loop` action. The
body groups existing information into Overview, Plan, Execution, and Evidence.
The context rail uses B2 delivery tracking and never replaces the primary
action. On mobile, the action sits beneath the title and task context opens on
demand.

### Review, Runtime, And Operations

Review is a dedicated decision queue reusing `review-inbox` data and deep
links. Runtime groups existing operator data into Agents, Environment, and
Exceptions, with retry available only where the existing query supports it.
All remaining operator controls, rules, benchmark evidence, recipes, and
governance remain in Operations behind `More`; nothing is deleted.

### New Task And Settings

The existing `/loops/new` flow becomes a focused composition page: request
first, then workspace/template/tenant context, normalized preview, and an
advanced-options disclosure. It preserves every existing validation and
submission contract. Settings remains a shell route for account, language,
and readable workspace context only; this redesign adds no preference API.

## Implementation Boundaries

- Preserve all ts-rest Loop contracts, existing mutation semantics, tenant
  context, SSO behavior, locale routing, anchors, and compatibility routes.
- Reuse `useLoopsWorkspaces`, list, metrics, notifications, agent-runtime,
  and simple-intake hooks. Do not introduce raw `fetch` calls or a project API.
- Treat `LoopWorkspaceSummary` as the sidebar's data source. It identifies a
  workspace with `workspaceId`, `root`, readiness status, default state, and
  selected agent profiles; UI labels should derive from the root until a
  dedicated display name exists.
- Break presentation into small shell, workspace, inbox, and context components
  instead of growing `apps/web/app/loops/page.tsx` further.
- Maintain Simplified Chinese and English resources together, with Chinese as
  the default route experience.

## States, Accessibility, And Quality

- Every destination keeps the shell visible during loading, error, and empty
  states. A retry action only retries the failing query.
- Sidebar entries, icon-only controls, context-rail trigger, composer submit,
  and status changes have accessible names, keyboard focus, and non-color
  labels.
- Tabs and sheets use the existing UI primitives and preserve focus when
  opened and closed.
- Verify 320px, 768px, 1024px, and 1440px layouts with browser screenshots;
  text must not clip or cause horizontal scrolling.
- Test the happy paths: resume, create Issue from conversation, navigate a
  workspace, open review, open runtime, and change language. Test the error
  paths: list unavailable, composer failure, and runtime unavailable.

## Acceptance Criteria

- All localized authenticated routes render the same shell and workspace-first
  sidebar.
- Home shows one `Continue Loop` item, then an actionable task inbox and
  composer.
- `/loops` creates an Issue from a conversational request and shows B2 delivery
  tracking for its selected Issue.
- New Task, Home, Scheduled, Search, workspace selection, Review, Runtime,
  Operations, Settings, and account controls are reachable in one navigation
  interaction from the shell.
- The default task UI does not render the full management dashboard, while all
  existing management data remains reachable through `More` or issue evidence.
- Focused unit tests, type check, lint, existing quality gate, and authenticated
  browser checks pass without modifying Loop, SSO, or API contracts.

## Usability Validation

### Automated Browser Validation (2026-07-14)

- `workbench-navigation.spec.ts` passed in Chromium with the synthetic authenticated session.
- Desktop core navigation and More-menu destinations rendered without horizontal overflow.
- The default Chinese route preserved unprefixed destinations.
- The 320px mobile Sheet closed after Scheduled navigation and exposed the destination page.

Run a five-person usability check after the first implementation slice: two
Loop owners, two reviewers, and one operator. Ask each participant to resume a
task, create a task, locate a pending review, and inspect a runtime exception.
Targets are at least 85% task completion, no critical navigation failure, and
a System Usability Scale score of at least 80. Log task time and error count
alongside qualitative feedback before expanding the design beyond the shell and
core task pages.
