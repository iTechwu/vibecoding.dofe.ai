# Vibecoding Codex Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disconnected authenticated surfaces with one Codex-style,
task-first Vibecoding workbench while retaining the existing Loop engine,
contracts, tenant context, and operator evidence.

**Architecture:** Keep `apps/web/app/loops` as the data and interaction source of
truth. Add a small workbench presentation layer for shared shell primitives and
Home composition, then progressively move the current dashboard's task-first
sections ahead of the management sections. The existing `review-inbox` and
`agent-runtime` element IDs stay stable, so compatibility links and E2E
bookmarks continue to work.

**Tech Stack:** Next.js App Router, React 19, TypeScript, next-intl, TanStack
Query through the existing ts-rest hooks, Tailwind CSS 4, shadcn primitives in
`@repo/ui`, Vitest, Playwright.

---

## Preconditions And File Map

Execute this work in a fresh `codex/codex-workbench-ui` worktree created from
the latest committed `main`. Do not switch the current dirty worktree or stage
its existing changes.

| File                                                           | Responsibility                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/web/components/layout/app-shell.tsx`                     | Workbench-scoped dark canvas, header/sidebar geometry, content inset                          |
| `apps/web/components/layout/app-sidebar.tsx`                   | Product navigation, New Issue command, review count, footer navigation                        |
| `apps/web/components/layout/app-navbar.tsx`                    | Current destination label and existing account/locale controls                                |
| `apps/web/components/workbench/page-header.tsx`                | Shared compact page heading and optional primary action                                       |
| `apps/web/components/workbench/home-workbench.tsx`             | Task-first authenticated Home using existing Loop list/metrics/notification data              |
| `apps/web/components/workbench/workbench-selectors.ts`         | Pure focus, active-work, and review-count selectors with unit tests                           |
| `apps/web/app/page.tsx`                                        | Replaces scaffold landing content with Home workbench composition                             |
| `apps/web/app/loops/page.tsx`                                  | Keeps current queries but renders Issues first and makes Operations progressive               |
| `apps/web/app/loops/[issueId]/page.tsx`                        | Converts dense body into Overview, Plan, Execution, Evidence tabs without changing operations |
| `apps/web/app/loops/new/page.tsx`                              | Applies focused composer page frame without changing form submission                          |
| `apps/web/app/[locale]/settings/page.tsx`                      | Replaces redirect with shell-wrapped client settings surface                                  |
| `apps/web/locales/{en,zh-CN}/{navigation,loops,settings}.json` | Paired localized labels and state copy                                                        |
| `apps/web/**/*.test.tsx`, `apps/web/e2e/loops-shell.spec.ts`   | Focused unit, component, route, and shell regression coverage                                 |

## Task 1: Establish Workbench Tokens And Navigation

**Files:**

- Create: `apps/web/components/layout/app-sidebar.test.tsx`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/components/layout/app-sidebar.tsx`
- Modify: `apps/web/components/layout/app-navbar.tsx`
- Modify: `apps/web/locales/en/navigation.json`
- Modify: `apps/web/locales/zh-CN/navigation.json`

- [ ] **Step 1: Write the failing sidebar navigation test.**

```tsx
it('renders the task-first workbench destinations and creation command', () => {
  render(<AppSidebar reviewCount={2} />);

  expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: /issues/i })).toHaveAttribute('href', '/loops');
  expect(screen.getByRole('link', { name: /review.*2/i })).toHaveAttribute(
    'href',
    '/loops#review-inbox',
  );
  expect(screen.getByRole('link', { name: /runtime/i })).toHaveAttribute(
    'href',
    '/loops#agent-runtime',
  );
  expect(screen.getByRole('link', { name: /new issue/i })).toHaveAttribute('href', '/loops/new');
});
```

- [ ] **Step 2: Run the focused test and verify it fails because `reviewCount`
      and the destination links do not exist.**

Run: `pnpm --filter @repo/web test components/layout/app-sidebar.test.tsx`

Expected: FAIL with the old dashboard-only navigation.

- [ ] **Step 3: Introduce an explicit navigation item contract and render the
      destinations.**

```tsx
export type AppSidebarProps = { reviewCount?: number };

const navItems = [
  { key: 'home', href: '/', icon: House },
  { key: 'issues', href: '/loops', icon: ListTodo },
  { key: 'review', href: '/loops#review-inbox', icon: Inbox },
  { key: 'runtime', href: '/loops#agent-runtime', icon: Cpu },
] as const;

export function AppSidebar({ reviewCount = 0 }: AppSidebarProps) {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/loops/new">
                <Plus />
                {t('menu.newIssue')}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.key}>
              <SidebarMenuButton asChild isActive={pathname === item.href.split('#')[0]}>
                <Link href={item.href}>
                  <item.icon />
                  {t(`menu.${item.key}`)}
                  {item.key === 'review' && reviewCount > 0 ? <Badge>{reviewCount}</Badge> : null}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
```

Set the `dark` class and `data-workbench` on the outer AppShell wrapper. Keep
the existing `SidebarProvider`, persisted collapse behavior, mobile Sheet, and
account menu. Make the desktop header `h-[52px]`, use the existing semantic
background/border variables, and remove the duplicate per-page `min-h-screen`
assumption from shell-owned routes only after those routes are converted.

- [ ] **Step 4: Add paired localized navigation keys.**

```json
{
  "menu": {
    "home": "Home",
    "issues": "Issues",
    "review": "Review",
    "runtime": "Runtime",
    "newIssue": "New Issue",
    "settings": "Settings"
  }
}
```

Add the corresponding Simplified Chinese values in the matching JSON shape.
Use the existing `navigation.menu` namespace; do not create an untyped second
navigation namespace.

- [ ] **Step 5: Run focused tests and static checks.**

Run: `pnpm --filter @repo/web test components/layout/app-sidebar.test.tsx && pnpm --filter @repo/web type-check`

Expected: PASS, with no missing translation key error.

- [ ] **Step 6: Commit the shell slice.**

```bash
git add apps/web/components/layout apps/web/locales/en/navigation.json apps/web/locales/zh-CN/navigation.json
git commit -m "feat: add task-first workbench navigation"
```

## Task 2: Build Testable Workbench Selectors And Home

**Files:**

- Create: `apps/web/components/workbench/workbench-selectors.ts`
- Create: `apps/web/components/workbench/workbench-selectors.test.ts`
- Create: `apps/web/components/workbench/home-workbench.tsx`
- Create: `apps/web/components/workbench/home-workbench.test.tsx`
- Create: `apps/web/components/workbench/page-header.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/[locale]/page.tsx`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/locales/en/loops.json`
- Modify: `apps/web/locales/zh-CN/loops.json`

- [ ] **Step 1: Write selector tests before writing the selector.**

```ts
it('prefers a non-paused in-loop issue as the continuation item', () => {
  expect(selectContinuationIssue(items)?.issue.id).toBe('issue-live');
});

it('puts paused and human-gated issues before inactive issues', () => {
  expect(selectActionableIssues(items).map((item) => item.issue.id)).toEqual([
    'issue-review',
    'issue-paused',
    'issue-live',
  ]);
});
```

- [ ] **Step 2: Run the selector test.**

Run: `pnpm --filter @repo/web test components/workbench/workbench-selectors.test.ts`

Expected: FAIL because `selectContinuationIssue` and `selectActionableIssues`
are not exported.

- [ ] **Step 3: Implement pure, API-agnostic selectors.**

```ts
import type { LoopIssueListItem } from '@repo/contracts';

export function selectContinuationIssue(items: LoopIssueListItem[]) {
  return (
    items.find((item) => item.issue.status === 'IN_LOOP' && !item.state?.paused) ??
    items.find((item) => !item.state?.paused && item.issue.status !== 'CLOSED') ??
    items[0]
  );
}

export function selectActionableIssues(items: LoopIssueListItem[]) {
  return [...items].sort((left, right) => actionRank(left) - actionRank(right));
}

function actionRank(item: LoopIssueListItem) {
  if (item.state?.paused || item.state?.phase === 'PHASE_2_REVIEW') return 0;
  if (item.issue.status === 'IN_LOOP') return 1;
  if (item.issue.status !== 'CLOSED') return 2;
  return 3;
}
```

`actionRank` ranks human review or paused items first, active items next, and
terminal items last.

- [ ] **Step 4: Write the Home component test.**

```tsx
it('shows one continuation item and links it to the issue detail', () => {
  render(<HomeWorkbench />);

  expect(screen.getByRole('heading', { name: /continue where you left off/i })).toBeVisible();
  expect(screen.getByRole('link', { name: /fix checkout/i })).toHaveAttribute(
    'href',
    '/loops/issue-live',
  );
  expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute(
    'href',
    '/loops#review-inbox',
  );
});
```

Mock only `useLoopsList`, `useLoopsMetrics`, and `useLoopsNotifications`; reuse
the existing `buildReviewInbox` model instead of creating an alternate review
calculation.

- [ ] **Step 5: Implement `PageHeader` and `HomeWorkbench`.**

```tsx
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      {action}
    </header>
  );
}
```

`HomeWorkbench` renders a continuation row, a bounded review list, and a
bounded recent-issues list. It uses Skeleton while the list is unresolved, an
announced retryable error when the list query fails, and `New Issue` as the
empty-state action. Replace `app/page.tsx` scaffold markup with this component;
keep `[locale]/page.tsx` as the AppShell wrapper.

- [ ] **Step 6: Keep the navigation count an optional presentation input.**

`AppShell` passes `reviewCount={0}` until a route already owns the notification
data needed to calculate it. Do not mount a global notification query merely
to populate a sidebar badge. The Review label and destination remain available
on every route; Task 3 may pass its already-derived count when it renders the
dashboard inside a shell-aware route.

- [ ] **Step 7: Run focused tests.**

Run: `pnpm --filter @repo/web test components/workbench/workbench-selectors.test.ts components/workbench/home-workbench.test.tsx && pnpm --filter @repo/web type-check`

Expected: PASS.

- [ ] **Step 8: Commit the Home slice.**

```bash
git add apps/web/app/page.tsx apps/web/app/[locale]/page.tsx apps/web/components/workbench apps/web/components/layout/app-shell.tsx apps/web/locales
git commit -m "feat: add task-first workbench home"
```

## Task 3: Convert The Issue Dashboard To A Task-First Issues View

**Files:**

- Create: `apps/web/app/loops/loops-issues-view.tsx`
- Create: `apps/web/app/loops/loops-operations-view.tsx`
- Create: `apps/web/app/loops/loops-issues-view.test.tsx`
- Modify: `apps/web/app/loops/page.tsx`
- Modify: `apps/web/app/loops/page.test.tsx`
- Modify: `apps/web/locales/en/loops.json`
- Modify: `apps/web/locales/zh-CN/loops.json`

- [ ] **Step 1: Add a failing view test for task-first ordering and retained
      operations anchors.**

```tsx
it('renders active work before operations and retains deep-link anchors', () => {
  render(<LoopsPage />);

  expect(screen.getByRole('heading', { name: /active work/i })).toBeVisible();
  expect(document.getElementById('review-inbox')).not.toBeNull();
  expect(document.getElementById('agent-runtime')).not.toBeNull();
  expect(screen.getByRole('button', { name: /operations/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the dashboard test.**

Run: `pnpm --filter @repo/web test app/loops/page.test.tsx app/loops/loops-issues-view.test.tsx`

Expected: FAIL because the task and operations sections are not separately
named components.

- [ ] **Step 3: Extract the default Issues surface without changing queries.**

```tsx
export function LoopsIssuesView({ items, isLoading, error }: LoopsIssuesViewProps) {
  if (isLoading) return <IssueListSkeleton />;
  if (error) return <IssueListError />;
  return <IssueRows items={selectActionableIssues(items)} />;
}
```

Move the command/search control, compact summary, active queue, and existing
issue table into `LoopsIssuesView`. The default page first viewport must contain
only the page header, filter/search controls, active rows, and a reachable
Operations trigger. Do not introduce a new API request, change the resume
mutation, or delete current board/table test assertions.

- [ ] **Step 4: Move management surfaces behind a progressive Operations view.**

```tsx
const MANAGEMENT_HASHES = new Set([
  '#review-inbox',
  '#exception-center',
  '#runtime-panel',
  '#agent-runtime',
]);

export function LoopsOperationsView({ children }: { children: ReactNode }) {
  const t = useTranslations('loops.dashboard');
  const [open, setOpen] = useState(
    () => typeof window !== 'undefined' && MANAGEMENT_HASHES.has(window.location.hash),
  );
  return (
    <section aria-labelledby="operations-title" id="operations">
      <button
        aria-controls="operations-content"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {t('operations.title')}
      </button>
      {open ? <div id="operations-content">{children}</div> : null}
    </section>
  );
}
```

Place existing metrics, policy, benchmark, recipe, learning, registry, release,
and trace sections in this component. Keep `review-inbox`, `exception-center`,
`runtime-panel`, and `agent-runtime` element IDs inside it; when the URL hash
targets one of them, initialize Operations open and scroll the target into view.
Define `MANAGEMENT_HASHES` once as a `Set` containing those four hash strings
and add the `operations.title` translation in both Loop locale files.

- [ ] **Step 5: Run dashboard regression tests and inspect the first viewport.**

Run: `pnpm --filter @repo/web test app/loops/page.test.tsx app/loops/loops-issues-view.test.tsx && pnpm --filter @repo/web type-check`

Expected: PASS; existing review/runtime anchor tests remain green.

- [ ] **Step 6: Commit the Issues slice.**

```bash
git add apps/web/app/loops/page.tsx apps/web/app/loops/loops-issues-view.tsx apps/web/app/loops/loops-operations-view.tsx apps/web/app/loops/*.test.tsx apps/web/locales
git commit -m "feat: prioritize actionable issues in workbench"
```

## Task 4: Make New Issue And Settings Consistent With The Shell

**Files:**

- Create: `apps/web/app/settings/settings-panel.tsx`
- Create: `apps/web/app/settings/settings-panel.test.tsx`
- Modify: `apps/web/app/loops/new/page.tsx`
- Modify: `apps/web/app/loops/new/new-loop-issue-form.test.tsx`
- Modify: `apps/web/app/[locale]/settings/page.tsx`
- Modify: `apps/web/locales/en/settings.json`
- Modify: `apps/web/locales/zh-CN/settings.json`

- [ ] **Step 1: Write the failing composer and settings route tests.**

```tsx
it('keeps the request field first and advanced options collapsed', () => {
  render(<SimpleLoopIssueForm defaultTargetRepo="/repo/app" />);
  expect(screen.getByLabelText(/request/i)).toBeVisible();
  expect(screen.getByRole('button', { name: /advanced options/i })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

it('renders locale and account context without redirecting', () => {
  render(<SettingsPanel />);
  expect(screen.getByRole('heading', { name: /settings/i })).toBeVisible();
  expect(screen.getByText(/language/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the new tests.**

Run: `pnpm --filter @repo/web test app/loops/new/new-loop-issue-form.test.tsx app/settings/settings-panel.test.tsx`

Expected: FAIL because the New Issue page contains the previous workbench
header and settings redirects.

- [ ] **Step 3: Apply the shared page frame to New Issue.**

Replace only `NewLoopIssuePage` framing markup with `PageHeader`, request-first
layout, and a normal page container. Keep `SimpleLoopIssueForm`'s query hooks,
tenant display, normalized preview, form controls, validation IDs, and mutation
payload unchanged. The advanced disclosure remains owned by the form.

- [ ] **Step 4: Add a client-only Settings panel and shell wrapper.**

```tsx
export function SettingsPanel() {
  const { user } = useAuth();
  const locale = useLocale();
  const t = useTranslations('settings');
  return (
    <section aria-labelledby="settings-title">
      <h1 id="settings-title">{t('title')}</h1>
      <dl>
        <div>
          <dt>{t('account')}</dt>
          <dd>{user?.nickname ?? t('unavailable')}</dd>
        </div>
        <div>
          <dt>{t('language')}</dt>
          <dd>{locale}</dd>
        </div>
      </dl>
    </section>
  );
}
```

The localized settings page becomes a client wrapper that renders `AppShell` and
`SettingsPanel`. Display the existing account identity, language switcher, and
available tenant/workspace context as read-only. Do not introduce a preference
mutation, storage schema, or server route.

- [ ] **Step 5: Run focused tests and type check.**

Run: `pnpm --filter @repo/web test app/loops/new/new-loop-issue-form.test.tsx app/settings/settings-panel.test.tsx && pnpm --filter @repo/web type-check`

Expected: PASS.

- [ ] **Step 6: Commit the composer/settings slice.**

```bash
git add apps/web/app/loops/new apps/web/app/settings apps/web/app/[locale]/settings apps/web/locales
git commit -m "feat: align issue intake and settings with workbench"
```

## Task 5: Reorganize Issue Detail Around Actionable Tabs

**Files:**

- Create: `apps/web/app/loops/[issueId]/issue-detail-header.tsx`
- Create: `apps/web/app/loops/[issueId]/issue-detail-tabs.tsx`
- Create: `apps/web/app/loops/[issueId]/issue-detail-tabs.test.tsx`
- Modify: `apps/web/app/loops/[issueId]/page.tsx`
- Modify: `apps/web/app/loops/[issueId]/page.test.tsx`
- Modify: `apps/web/locales/en/loops.json`
- Modify: `apps/web/locales/zh-CN/loops.json`

- [ ] **Step 1: Write the failing tab behavior test.**

```tsx
it('keeps Continue Loop in the header and exposes four keyboard-accessible tabs', () => {
  render(<LoopIssueDetailPage />);

  expect(screen.getByRole('button', { name: /continue loop/i })).toBeVisible();
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'Overview',
    'Plan',
    'Execution',
    'Evidence',
  ]);
  expect(screen.getByRole('tabpanel', { name: /overview/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the detail test.**

Run: `pnpm --filter @repo/web test app/loops/[issueId]/page.test.tsx app/loops/[issueId]/issue-detail-tabs.test.tsx`

Expected: FAIL because the current detail surface has no tablist.

- [ ] **Step 3: Extract the stable issue header.**

```tsx
export function IssueDetailHeader({ detail, nextAction }: IssueDetailHeaderProps) {
  return (
    <header aria-labelledby="issue-title">
      <Breadcrumbs issueId={detail.issue.id} />
      <h1 id="issue-title">{detail.issue.title}</h1>
      <IssueStatusSummary detail={detail} />
      <NextActionControl action={nextAction} />
    </header>
  );
}
```

Move the existing primary operation and its disabled/loading/error behavior into
`NextActionControl`; do not reimplement operation hooks or change any action
payload. Include tenant context and current phase in `IssueStatusSummary`.

- [ ] **Step 4: Group existing content into four tab panels.**

```tsx
const detailTabs = [
  { value: 'overview', label: t('tabs.overview') },
  { value: 'plan', label: t('tabs.plan') },
  { value: 'execution', label: t('tabs.execution') },
  { value: 'evidence', label: t('tabs.evidence') },
] as const;
```

Overview contains the next-action diagnostic, concise progress, and human gate.
Plan contains spec, requirements, and shards. Execution contains agent handoff,
runtime, and checkpoints. Evidence contains implementation, tests, reviews,
Browser QA, release, and audit data. Preserve every existing operation button
inside the panel that owns its evidence and keep existing anchor IDs for tests
and deep links. Start on Evidence when the initial URL hash names an evidence
anchor; otherwise start on Overview.

- [ ] **Step 5: Run detail tests and keyboard navigation coverage.**

Run: `pnpm --filter @repo/web test app/loops/[issueId]/page.test.tsx app/loops/[issueId]/issue-detail-tabs.test.tsx && pnpm --filter @repo/web type-check`

Expected: PASS and existing tenant/human-gate tests remain green.

- [ ] **Step 6: Commit the issue-detail slice.**

```bash
git add apps/web/app/loops/[issueId] apps/web/locales
git commit -m "feat: organize issue detail by work stage"
```

## Task 6: Complete Browser And Responsive Regression Coverage

**Files:**

- Modify: `apps/web/e2e/loops-shell.spec.ts`
- Create: `apps/web/e2e/workbench-navigation.spec.ts`
- Modify: `apps/web/app/loops/page.test.tsx`
- Modify: `apps/web/app/loops/[issueId]/page.test.tsx`

- [ ] **Step 1: Add a failing authenticated-shell route test.**

```ts
test('workbench navigation reaches every authenticated destination', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /issues/i }).click();
  await expect(page).toHaveURL(/\/loops$/);
  await page.getByRole('link', { name: /runtime/i }).click();
  await expect(page.locator('#agent-runtime')).toBeVisible();
});
```

Use the existing controlled test authentication fixture or response mocks. Do
not add a real SSO credential dependency to this suite.

- [ ] **Step 2: Run the new browser test and verify it fails before the routes
      are fully wired.**

Run: `pnpm --filter @repo/web test:e2e -- workbench-navigation.spec.ts`

Expected: FAIL until Home, navigation, and runtime anchors are available in the
same shell.

- [ ] **Step 3: Add viewport assertions for the only layout changes that can
      regress.**

```ts
for (const viewport of [
  { width: 320, height: 800 },
  { width: 768, height: 900 },
  { width: 1440, height: 960 },
]) {
  test(`workbench navigation is usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/loops');
    await expect(page.getByRole('main')).toBeVisible();
  });
}
```

At 320px, assert the menu trigger opens the existing Sheet and `New Issue` is
reachable. At 768px and 1440px, assert no horizontal overflow on `body` and
the primary action is visible.

- [ ] **Step 4: Run all web regressions.**

Run: `pnpm --filter @repo/web test && pnpm --filter @repo/web lint && pnpm --filter @repo/web type-check && pnpm --filter @repo/web test:e2e -- loops-shell.spec.ts workbench-navigation.spec.ts`

Expected: PASS. Investigate failures with the actual route or accessibility
output before changing assertions.

- [ ] **Step 5: Run the repository quality gate.**

Run: `pnpm quality:gate`

Expected: PASS. This is required because the redesign changes the release-facing
authenticated navigation surface.

- [ ] **Step 6: Commit verification-only changes.**

```bash
git add apps/web/e2e apps/web/app/loops/page.test.tsx apps/web/app/loops/[issueId]/page.test.tsx
git commit -m "test: cover codex workbench navigation"
```

## Plan Review

| UI requirement                                                    | Implementing task                                   |
| ----------------------------------------------------------------- | --------------------------------------------------- |
| One shell with Home, Issues, Review, Runtime, Settings, New Issue | Task 1 and Task 4                                   |
| Task-first Home and Issues                                        | Task 2 and Task 3                                   |
| Focused issue intake                                              | Task 4                                              |
| Detail organized by Overview, Plan, Execution, Evidence           | Task 5                                              |
| Management remains reachable with stable anchors                  | Task 3 and Task 5                                   |
| Mobile, keyboard, loading, empty, and error behavior              | Tasks 1 through 6                                   |
| No API, auth, tenant, or state-machine changes                    | All tasks use existing hooks and mutation contracts |

Self-review completed: this plan contains no placeholder requirements, retains
the documented deep-link IDs, and keeps the current dirty worktree isolated
from execution.
