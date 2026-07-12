# Vibecoding Codex Workbench UI Specification

## Purpose

This document turns the approved workbench architecture into an implementation-ready
product UI. It applies to authenticated routes only and preserves all existing Loop,
tenant, SSO, API, and locale behavior.

## Evidence And Design Hypothesis

Three repository signals support the redesign:

1. The default authenticated sidebar offers only a generic dashboard while the
   Loop surface has its own full-screen workbench.
2. The Loop dashboard combines more than thirty independent sections, including
   task work, approvals, runtime health, and operator diagnostics.
3. Existing UI review evidence identifies a dense first-run detail view where
   delivery controls compete with the product-level next action.

**Hypothesis:** A task-first workbench that keeps operational controls reachable
but secondary will let a Loop owner create, resume, or review work with less
searching while preserving the evidence required by an operator.

## Personas And Journeys

| Persona    | Goal                     | Primary path                                    | Failure to prevent                                        |
| ---------- | ------------------------ | ----------------------------------------------- | --------------------------------------------------------- |
| Loop owner | Move a request forward   | Home -> Continue -> Issue detail                | Needing to interpret runtime diagnostics before advancing |
| Reviewer   | Make a human decision    | Home or Review -> Issue detail -> Review action | Missing a waiting decision in a large dashboard           |
| Operator   | Diagnose delivery health | Runtime -> agent or exception -> linked issue   | Losing access to policy, runtime, or evidence data        |

### Core Journey: Resume A Loop

```text
Sign in
  -> Home shows the single highest-priority continuation
  -> Select Continue Loop
  -> Issue detail opens with the next action fixed in the header
  -> Confirm action or resolve the human gate
  -> Updated phase and evidence feedback are announced
```

### Error Journey: Runtime Is Unavailable

```text
Runtime query fails
  -> Runtime screen keeps shell navigation visible
  -> Inline error explains that runtime data was not loaded
  -> Retry re-runs the existing query
  -> Linked issue actions remain available unless the server reports a blocker
```

## Product Principles

1. **The next action wins.** One product-level action is prominent per task.
2. **Operations are nearby, not in the way.** Runtime, policy, and evidence are
   discoverable through a named destination or a contextual tab.
3. **Status has a reason.** Status uses text and iconography alongside color.
4. **A screen has one job.** Home resumes work, Issues finds work, Review decides,
   Runtime operates, and Settings configures the client.
5. **Density is intentional.** Lists are compact for scanning; page sections are
   not a collection of decorative cards.

## Navigation And Shell

### Desktop Frame

```text
+----------------------+---------------------------------------------------+
| Vibecoding           | [Page name]                         [Search][User] |
|                      +---------------------------------------------------+
| [+ New Issue]        |                                                   |
|                      |                 Route content                     |
| Home                 |                                                   |
| Issues               |                                                   |
| Review        [n]    |                                                   |
| Runtime              |                                                   |
|                      |                                                   |
| Settings             |                                                   |
| Account              |                                                   |
+----------------------+---------------------------------------------------+
```

- Sidebar width is 232px when expanded and 52px when collapsed. The mark and
  icon buttons stay visible when collapsed; labels use tooltips.
- Header height is 52px. It has a border below it and no second navigation row.
- `New Issue` uses the primary button variant. The active navigation item uses
  a quiet filled background and a 2px leading indicator.
- Review displays a numeric count only when an item requires the current user.
  A count is supplementary status, not the sole signal.
- Account and Settings occupy the sidebar footer. Account opens the existing
  menu; Settings opens the application settings route.

### Responsive Rules

| Viewport         | Shell behavior                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 320px to 767px   | Sidebar becomes the existing Sheet drawer. Header retains menu, page name, and account controls. Primary page action is full width when needed. |
| 768px to 1023px  | Expanded sidebar is available; content uses a single task column and collapses side context below it.                                           |
| 1024px and above | Sidebar stays pinned. Issue detail may use a 1fr / 320px content grid.                                                                          |
| 1440px and above | Main content caps at 1440px. Wide screens add whitespace, not extra columns.                                                                    |

## Visual Tokens

Tokens apply inside the workbench shell only. They map to the existing shared
semantic CSS variables in `@repo/ui`; they do not alter shared defaults.

| Role             | Value     | Use                                      |
| ---------------- | --------- | ---------------------------------------- |
| Canvas           | `#0b0c0e` | Application background                   |
| Sidebar          | `#121417` | Persistent navigation                    |
| Surface          | `#171a1f` | Tables, dialog bodies, focused panels    |
| Raised surface   | `#1d2127` | Hovered list row, compact status control |
| Border           | `#2c3139` | Dividers and control outlines            |
| Foreground       | `#f5f7fa` | Primary text                             |
| Muted foreground | `#a8afb9` | Supporting labels and metadata           |
| Action           | `#6eb8ff` | Primary actions, links, focus affordance |
| Success          | `#71c58b` | Passed, ready, complete                  |
| Warning          | `#efb45c` | Waiting, review, attention               |
| Danger           | `#e77b75` | Failed, blocked, destructive action      |

- No gradients, glow effects, or decorative illustrations.
- Use 4px spacing increments. Standard page padding is 16px on mobile, 24px on
  tablet, and 32px on desktop.
- Use 6px radius for inputs and buttons, and 8px for compact framed tools. Do
  not use rounded cards to divide a page into unrelated regions.
- Typography uses the existing Geist Sans and Geist Mono. Page titles are 24px,
  section titles 16px, body text 14px, labels 12px, and monospace IDs 12px.

## Screen Specifications

### 1. Home

```text
[Home]                                             [New Issue]

Continue where you left off
Issue title                                      [Continue Loop]
Phase, current owner, last update

Waiting for your decision (2)
Issue title                    Phase / decision required       [Review]
Issue title                    Phase / decision required       [Review]

Recent issues
Title                  Phase        Owner        Updated          >
```

- The continuation item is the only elevated surface on the screen.
- Review and recent issues are dense rows separated by borders, with a row
  click target and a separately labeled action where necessary.
- Empty Home shows `New Issue` as the primary action and a short, local
  explanation. It does not show management charts.

### 2. Issues

```text
[Issues]                                      [New Issue]
[Search issues...................] [Phase v] [Status v] [Sort v]

Active work
Title                    Phase           Owner       Updated       >
Title                    Waiting review  You         4 min ago     >

More work
Title                    Closed          Agent       Yesterday     >
```

- The first viewport contains title, controls, and active work. Metrics are
  compact text counters beside the title, not independent cards.
- Default sorting is actionability: blocked and human-gated issues first,
  followed by active work, then recent inactive work.
- Existing board, release, benchmark, learning, and policy data move under an
  `Operations` disclosure below the list or under Runtime. Their current deep
  link IDs remain valid.

### 3. New Issue

```text
[New Issue]                                      [Back to issues]

Describe the work
[                                                     ]
[                                                     ]

Workspace [current workspace v]   Template [Automatic v]
Tenant: readable tenant name

Prepared issue
Generated title, priority, acceptance summary

[Create issue]                    Advanced options
```

- Focus moves to the request field on entry. Request text is visually dominant.
- Workspace, template, tenant, and preview use standard form structure, not a
  multi-step wizard.
- Advanced options use a disclosure below the primary submit action. Existing
  validation message IDs remain attached to their fields.
- A submission error appears directly above the submit action and preserves
  entered values. A tenant warning explains the workspace fallback without
  preventing submission unless the existing API blocks it.

### 4. Issue Detail

```text
Issues / Issue ID
Issue title                                             [Continue Loop]
Phase [Build]  Status [Active]  Tenant [Name]

[Overview] [Plan] [Execution] [Evidence]
---------------------------------------------------------------
Overview: next action, current agent, concise progress
                                   | Context
                                   | phase / owner / updated
```

- Header is not a card. It is a page-level region with the issue identity,
  tenant, phase, and one primary action.
- `Continue Loop` remains visible in the header on desktop and becomes a
  full-width action beneath the title on mobile.
- Overview holds the next-action explanation, human gate, and progress.
  Plan holds spec and shards. Execution holds agent handoff and runtime status.
  Evidence holds test, review, QA, release, and audit artifacts.
- Tabs are semantic and keyboard accessible. Direct anchors to evidence and
  existing page content remain available for bookmarks and E2E coverage.
- When an operation is pending, only the affected action has a loading state.
  The rest of the issue stays readable.

### 5. Review

- Reuse the existing `review-inbox` data under a dedicated page heading and
  dense decision rows.
- Each row contains issue title, decision type, current phase, submitted time,
  and a `Review` action. The decision's supporting context appears only after
  entering issue detail.
- An empty state explicitly says no human review is waiting and links to Issues.

### 6. Runtime

- Reuse the existing `agent-runtime` and exception data under three sections:
  `Agents`, `Environment`, and `Exceptions`.
- Agent rows show status, current issue, phase, backend, and a link to detail.
  Environment shows readiness and a retry control only where the existing
  runtime query supports retry. Exceptions use the warning/danger tokens and
  retain links to their evidence.
- Operator-only lower-priority content such as rules, benchmarks, registry, and
  learning is grouped in an `Operations` tab. It is not removed.

### 7. Settings

- Settings is a real route within the shell, not a redirect. It contains only
  client-visible account, language, and contextual workspace information.
- Any unavailable preference is shown as read-only context. This design does
  not imply new persistence or mutation APIs.

## Component Contract

| Component         | Existing primitive               | Required states                                                 |
| ----------------- | -------------------------------- | --------------------------------------------------------------- |
| Workbench sidebar | Sidebar, Sheet, Tooltip          | Expanded, collapsed, mobile drawer, active item                 |
| Page header       | Button, Breadcrumb, DropdownMenu | Default, narrow layout, action pending                          |
| Work row          | Link, Badge, Separator           | Default, hover, keyboard focus, blocked, empty list             |
| Next-action panel | Button, Badge, Skeleton          | Ready, human gate, pending, server error, closed                |
| Issue tabs        | Tabs                             | Selected, keyboard focus, loading content, unavailable evidence |
| Status badge      | Badge                            | Neutral, success, warning, danger; always paired with text      |
| Data feedback     | Skeleton, Empty, Alert           | Loading, empty, retryable error, blocked state                  |

All icon-only controls must have accessible names and a tooltip. Buttons use
the existing sizes: 32px for compact contextual actions, 36px as default, and
40px for prominent commands. A destructive action always uses text plus icon.

## Interaction And Feedback

- Navigation preserves scroll only when returning to a list; new destinations
  begin at the page heading.
- Selecting `Review` or `Runtime` uses the destination route or existing anchor
  without duplicating data into a second source of truth.
- Search and filters update the visible issue list without moving the shell.
- A successful continuation announces the updated phase and moves focus to the
  next-action explanation. An error announces its reason and returns focus to
  the failed action.
- Sidebar collapse uses the existing persisted sidebar state and the existing
  keyboard mechanism. Shortcut hints are available in tooltips, not persistent
  instructional copy.

## Accessibility Requirements

- Text and interactive controls meet WCAG AA contrast against their assigned
  surfaces. The muted token is for secondary text only, never an action.
- Focus ring uses the Action token and is never suppressed.
- Status is represented by a label and icon in addition to color.
- Tables collapse to semantic stacked rows below 768px; no horizontal data is
  clipped without a scroll affordance.
- Loading skeletons use `aria-busy`; errors use an announced alert region;
  empty states retain an actionable next step.

## Prototype And Usability Validation

The product-design phase should validate the following mid-fidelity prototype
with five to eight participants: at least two Loop owners, two reviewers, and
one operator. Use realistic issue names and tenant context, not placeholder data.

| Task                                        | Success target | Time target      |
| ------------------------------------------- | -------------- | ---------------- |
| Create an Issue from a request              | 90% completion | Under 90 seconds |
| Find and advance the most urgent Loop       | 90% completion | Under 45 seconds |
| Resolve a waiting human review              | 85% completion | Under 60 seconds |
| Find a runtime exception linked to an issue | 80% completion | Under 90 seconds |

Record completion, time, errors, and SUS. A critical finding is any failure to
locate `Continue Loop`, an assigned review, or the runtime exception route.
Address critical findings before coding the affected view.

## Engineering Handoff Checklist

- Apply workbench tokens only through the web app's shell scope; do not change
  global `@repo/ui` token values.
- Reuse Sidebar, Sheet, Tabs, Button, Tooltip, Skeleton, Empty, and existing
  Loop query hooks.
- Preserve tenant confirmation, `review-inbox`, `agent-runtime`, and existing
  operation-control anchors and tests.
- Add English and Simplified Chinese strings in pairs.
- Test each route's loading, error, empty, and ready state at 320px, 768px,
  1024px, and 1440px.
