# VibeCoding Authenticated Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver the approved workspace-first, conversation-centered authenticated VibeCoding experience without changing Loop, SSO, tenant, or API contracts.

**Architecture:** Keep route ownership in apps/web/app, preserve the current operations route as the management surface, and add focused presentational workbench components under apps/web/components/workbench. The shared shell reads existing workspace data, Home composes the existing Loop list and review data, and task pages reuse existing Issue, SSE, runtime, and simple-intake hooks. No raw fetch, API schema, or persistence layer is introduced.

**Tech Stack:** Next.js App Router, React 19, TypeScript, next-intl, TanStack Query, ts-rest hooks, Tailwind CSS 4, @repo/ui, Vitest, Playwright.

---

## File Map

| File                                                           | Responsibility                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| apps/web/components/workbench/workspace-context.ts             | Derive display-safe workspace labels and selected workspace from existing query data. |
| apps/web/components/workbench/issue-request-composer.tsx       | Reusable accessible request composer with no API dependency.                          |
| apps/web/components/workbench/task-context-rail.tsx            | B2 delivery phase, environment, test, and change-summary rail.                        |
| apps/web/components/workbench/scheduled-issues-workbench.tsx   | Compact actionable inbox for the Scheduled destination.                               |
| apps/web/components/workbench/home-workbench.tsx               | H1 + H3 resume-plus-inbox home using existing queries.                                |
| apps/web/components/workbench/loops-conversation-workbench.tsx | Conversation workspace with selected Issue and B2 task context.                       |
| apps/web/components/layout/app-shell.tsx                       | Shared light workbench surface and responsive shell slots.                            |
| apps/web/components/layout/app-sidebar.tsx                     | S1 project-first navigation backed by useLoopsWorkspaces.                             |
| apps/web/app/loops/page.tsx                                    | Select conversation, scheduled, or existing operations view.                          |
| apps/web/app/loops/[issueId]/page.tsx                          | Reframe existing detail data in task-first header, tabs, and B2 rail.                 |
| apps/web/app/loops/new/page.tsx                                | Apply request-first layout around the existing simple issue form.                     |
| apps/web/app/loops/loops-operations-view.tsx                   | Keep named management entry and preserve review/runtime anchors.                      |
| apps/web/e2e/workbench-navigation.spec.ts                      | Exercise authenticated shell navigation and responsive behavior.                      |

### Task 1: Establish Workspace Presentation Helpers

**Files:**

- Create: apps/web/components/workbench/workspace-context.ts
- Create: apps/web/components/workbench/workspace-context.test.ts

- [ ] **Step 1: Write the failing pure-helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { getSelectedWorkspace, workspaceLabel } from './workspace-context';

const workspaces = [
  { workspaceId: 'web', root: '/code/storefront', status: 'READY', isDefault: true },
  { workspaceId: 'api', root: '/code/api-service', status: 'SELECTED', isDefault: false },
];

it('uses the last root segment as the safe workspace label', () => {
  expect(workspaceLabel(workspaces[0])).toBe('storefront');
});

it('prefers a valid requested workspace and falls back to current', () => {
  expect(getSelectedWorkspace(workspaces, 'api', 'web')?.workspaceId).toBe('api');
  expect(getSelectedWorkspace(workspaces, 'unknown', 'web')?.workspaceId).toBe('web');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: pnpm --filter @repo/web exec vitest run components/workbench/workspace-context.test.ts

Expected: FAIL because workspace-context.ts does not exist.

- [ ] **Step 3: Implement contract-only workspace helpers**

```ts
import type { LoopWorkspaceSummary } from '@repo/contracts';

export function workspaceLabel(workspace: Pick<LoopWorkspaceSummary, 'workspaceId' | 'root'>) {
  const parts = workspace.root.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.at(-1) || workspace.workspaceId;
}

export function getSelectedWorkspace(
  workspaces: LoopWorkspaceSummary[],
  requestedId: string | null,
  currentId: string | undefined,
) {
  return (
    workspaces.find((item) => item.workspaceId === requestedId) ??
    workspaces.find((item) => item.workspaceId === currentId) ??
    workspaces.find((item) => item.isDefault) ??
    workspaces[0]
  );
}
```

Do not mutate the current workspace or add a workspace-selection request. The requested id is presentation state only.

- [ ] **Step 4: Run the helper test and type check**

Run: pnpm --filter @repo/web exec vitest run components/workbench/workspace-context.test.ts && pnpm --filter @repo/web type-check

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the helper slice**

```bash
git add apps/web/components/workbench/workspace-context.ts apps/web/components/workbench/workspace-context.test.ts
git commit -m "feat: add workbench workspace presentation helpers"
```

### Task 2: Add The Reusable Request Composer And B2 Context Rail

**Files:**

- Create: apps/web/components/workbench/issue-request-composer.tsx
- Create: apps/web/components/workbench/issue-request-composer.test.tsx
- Create: apps/web/components/workbench/task-context-rail.tsx
- Create: apps/web/components/workbench/task-context-rail.test.tsx
- Modify: apps/web/components/index.ts
- Modify: apps/web/locales/zh-CN/loops.json
- Modify: apps/web/locales/en/loops.json

- [ ] **Step 1: Write failing composer and context-rail tests**

```tsx
it('submits on Enter but preserves a newline on Shift+Enter', async () => {
  const onSubmit = vi.fn();
  render(<IssueRequestComposer labels={labels} onSubmit={onSubmit} pending={false} />);
  const input = screen.getByRole('textbox', { name: labels.label });
  await user.type(input, 'Improve checkout recovery{enter}');
  expect(onSubmit).toHaveBeenCalledWith('Improve checkout recovery');
  await user.type(input, '{shift>}{enter}{/shift}second line');
  expect(input).toHaveValue(expect.stringContaining('\nsecond line'));
});

it('renders phase, test outcome, and unavailable environment as text', () => {
  render(
    <TaskContextRail
      state="active"
      phase="Implementation"
      tests="18 / 18 passed"
      environment="Unavailable"
    />,
  );
  expect(screen.getByText('Implementation')).toBeInTheDocument();
  expect(screen.getByText('18 / 18 passed')).toBeInTheDocument();
  expect(screen.getByText('Unavailable')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: pnpm --filter @repo/web exec vitest run components/workbench/issue-request-composer.test.tsx components/workbench/task-context-rail.test.tsx

Expected: FAIL because neither workbench component exists.

- [ ] **Step 3: Implement controlled, API-free presentation components**

```tsx
export function IssueRequestComposer({ draft, error, labels, onChange, onSubmit, pending }: Props) {
  const submit = () => {
    const request = draft.trim();
    if (request.length >= 10 && !pending) onSubmit(request);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="sr-only" htmlFor="issue-request-composer">
        {labels.label}
      </label>
      <textarea id="issue-request-composer" onChange={(event) => onChange(event.target.value)} />
      {error ? <p role="alert">{error}</p> : null}
      <button
        aria-label={labels.send}
        disabled={draft.trim().length < 10 || pending}
        type="submit"
      />
    </form>
  );
}
```

TaskContextRail accepts already-derived text rather than importing query hooks. Render named Delivery progress, Environment, Changes, and Validation sections. Use border-separated content, a 288px desktop width, and an accessible mobile trigger supplied by its parent.

- [ ] **Step 4: Run focused tests and export the components**

Run: pnpm --filter @repo/web exec vitest run components/workbench/issue-request-composer.test.tsx components/workbench/task-context-rail.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit the presentation primitives**

```bash
git add apps/web/components/workbench apps/web/components/index.ts apps/web/locales/zh-CN/loops.json apps/web/locales/en/loops.json
git commit -m "feat: add workbench composer and delivery context"
```

### Task 3: Rebuild The Shared Shell As S1 Navigation

**Files:**

- Modify: apps/web/components/layout/app-shell.tsx
- Modify: apps/web/components/layout/app-sidebar.tsx
- Modify: apps/web/components/layout/app-navbar.tsx
- Modify: apps/web/components/layout/app-sidebar.test.tsx
- Modify: apps/web/components/layout/app-navbar.test.tsx
- Modify: apps/web/app/globals.css
- Modify: apps/web/locales/zh-CN/navigation.json
- Modify: apps/web/locales/en/navigation.json

- [ ] **Step 1: Add failing S1 navigation assertions**

```tsx
expect(screen.getByRole('link', { name: '首页' })).toHaveAttribute('href', '/');
expect(screen.getByRole('link', { name: '已安排' })).toHaveAttribute(
  'href',
  '/loops?view=scheduled',
);
expect(screen.getByText('工作区')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '更多' })).toBeInTheDocument();
expect(screen.getByText('storefront')).toBeInTheDocument();
```

Mock useLoopsWorkspaces with a selected and a default workspace. Assert that account/logout remain available and that More retains operations and runtime destinations.

- [ ] **Step 2: Run shell tests and verify they fail**

Run: pnpm --filter @repo/web exec vitest run components/layout/app-sidebar.test.tsx components/layout/app-navbar.test.tsx

Expected: FAIL because the sidebar contains a single brand project and no workspace data.

- [ ] **Step 3: Implement workspace-first shell navigation**

```tsx
const workspacesQuery = useLoopsWorkspaces();
const selected = getSelectedWorkspace(workspaces, requestedWorkspaceId, currentWorkspaceId);

<SidebarGroupLabel>{t('groupProjects')}</SidebarGroupLabel>;
{
  workspaces.map((workspace) => (
    <SidebarMenuButton
      asChild
      isActive={workspace.workspaceId === selected?.workspaceId}
      key={workspace.workspaceId}
    >
      <Link href={'/loops?workspace=' + encodeURIComponent(workspace.workspaceId)}>
        <FolderKanban />
        <span>{workspaceLabel(workspace)}</span>
      </Link>
    </SidebarMenuButton>
  ));
}
```

Place New Task, Home, Scheduled, and Search above the workspace group. Keep Review, Runtime, Operations, and Settings in More. Change shell-specific classes from forced dark treatment to the documented light semantic surface; do not alter global shared @repo/ui token defaults. Keep the existing mobile SidebarTrigger and collapsed-sidebar tooltips.

- [ ] **Step 4: Run shell tests and type check**

Run: pnpm --filter @repo/web exec vitest run components/layout/app-sidebar.test.tsx components/layout/app-navbar.test.tsx && pnpm --filter @repo/web type-check

Expected: PASS; desktop and mobile sidebar test selectors remain present.

- [ ] **Step 5: Commit the shell slice**

```bash
git add apps/web/components/layout apps/web/app/globals.css apps/web/locales/zh-CN/navigation.json apps/web/locales/en/navigation.json
git commit -m "feat: make authenticated navigation workspace-first"
```

### Task 4: Implement H1 Plus H3 Home

**Files:**

- Modify: apps/web/components/workbench/home-workbench.tsx
- Modify: apps/web/components/workbench/home-workbench.test.tsx
- Modify: apps/web/app/page.tsx
- Create: apps/web/app/page.test.tsx
- Modify: apps/web/locales/zh-CN/loops.json
- Modify: apps/web/locales/en/loops.json

- [ ] **Step 1: Add failing home tests for continuation, inbox, and composer**

```tsx
expect(screen.getByRole('region', { name: '继续推进' })).toBeInTheDocument();
expect(screen.getByRole('heading', { name: '已安排' })).toBeInTheDocument();
expect(screen.getByRole('textbox', { name: '描述要执行的工作' })).toBeInTheDocument();
expect(screen.getByRole('link', { name: '审查：Review onboarding copy' })).toHaveAttribute(
  'href',
  '/loops/review',
);
```

Add an error case where useCreateSimpleLoopIssue rejects and assert that the draft remains visible with a role alert message.

- [ ] **Step 2: Run the home test and verify it fails**

Run: pnpm --filter @repo/web exec vitest run components/workbench/home-workbench.test.tsx

Expected: FAIL because Home has no task composer and its recent list is not an actionable Scheduled inbox.

- [ ] **Step 3: Compose existing queries into the new home surface**

```tsx
const continuation = selectContinuationIssue(items);
const scheduled = selectActionableIssues(items);
const createIssue = useCreateSimpleLoopIssue();

const submit = async (request: string) => {
  setSubmitError(undefined);
  try {
    const result = await createIssue.mutateAsync({ body: { request } });
    router.push('/loops/' + result.body.data.issue.id);
  } catch {
    setSubmitError(t('createError'));
  }
};
```

Render exactly one continuation region when a non-terminal Issue exists. Render actionable items as dense rows ordered by selectActionableIssues, with explicit Review links for human-gated items. Reuse IssueRequestComposer at the bottom; retain existing empty, loading, and retry behavior.

- [ ] **Step 4: Run home and route tests**

Run: pnpm --filter @repo/web exec vitest run components/workbench/home-workbench.test.tsx app/page.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit the home slice**

```bash
git add apps/web/components/workbench/home-workbench.tsx apps/web/components/workbench/home-workbench.test.tsx apps/web/app/page.tsx apps/web/app/page.test.tsx apps/web/locales/zh-CN/loops.json apps/web/locales/en/loops.json
git commit -m "feat: add resume and scheduled work home"
```

### Task 5: Upgrade The Conversation Workspace With B2 Context

**Files:**

- Modify: apps/web/components/workbench/loops-conversation-workbench.tsx
- Modify: apps/web/components/workbench/loops-conversation-workbench.test.tsx
- Modify: apps/web/app/loops/page.tsx
- Modify: apps/web/app/loops/page.test.tsx

- [ ] **Step 1: Add failing selected-Issue context tests**

```tsx
await user.click(screen.getByRole('button', { name: /Ship account settings/ }));
expect(screen.getByRole('complementary', { name: '交付追踪' })).toBeInTheDocument();
expect(screen.getByText('18 / 18 通过')).toBeInTheDocument();
expect(screen.getByText('main')).toBeInTheDocument();
```

Mock the SSE result for the selected Issue and a failed result for a second Issue. Assert that readable state text changes with selection and that failed state does not depend on color alone.

- [ ] **Step 2: Run conversation tests and verify they fail**

Run: pnpm --filter @repo/web exec vitest run components/workbench/loops-conversation-workbench.test.tsx app/loops/page.test.tsx

Expected: FAIL because the conversation has no complementary B2 context rail.

- [ ] **Step 3: Integrate composer and rail without changing mutation payloads**

```tsx
const activeIssue = orderedIssues.find((item) => item.issue.id === activeIssueId);
const stream = useLoopAdvanceSSE(activeIssueId, { enabled: Boolean(activeIssueId) });

<div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
  <ConversationHistory selectedIssueId={activeIssueId} onSelect={setSelectedIssueId} />
  <TaskContextRail {...getConversationContext(activeIssue, stream.status)} />
</div>;
```

Keep useCreateSimpleLoopIssue with body request, draft preservation, Enter behavior, and the existing direct Issue-detail link. On screens below 1024px, expose the rail through a labeled sheet trigger rather than rendering a third column.

- [ ] **Step 4: Run conversation and route tests**

Run: pnpm --filter @repo/web exec vitest run components/workbench/loops-conversation-workbench.test.tsx app/loops/page.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit the conversation slice**

```bash
git add apps/web/components/workbench/loops-conversation-workbench.tsx apps/web/components/workbench/loops-conversation-workbench.test.tsx apps/web/app/loops/page.tsx apps/web/app/loops/page.test.tsx
git commit -m "feat: show delivery tracking in conversation workspace"
```

### Task 6: Add Scheduled And Search Destinations Without New APIs

**Files:**

- Create: apps/web/components/workbench/scheduled-issues-workbench.tsx
- Create: apps/web/components/workbench/scheduled-issues-workbench.test.tsx
- Modify: apps/web/app/loops/page.tsx
- Modify: apps/web/app/loops/page.test.tsx
- Modify: apps/web/components/layout/app-navbar.tsx
- Modify: apps/web/components/layout/app-navbar.test.tsx
- Modify: apps/web/locales/zh-CN/loops.json
- Modify: apps/web/locales/en/loops.json

- [ ] **Step 1: Write failing Scheduled and command-link tests**

```tsx
render(<ScheduledIssuesWorkbench />);
expect(screen.getByRole('heading', { name: '已安排' })).toBeInTheDocument();
expect(screen.getByRole('link', { name: /恢复策略确认/ })).toHaveAttribute('href', '/loops/review');
expect(screen.getByPlaceholderText('搜索任务标题或 ID')).toBeInTheDocument();
```

Add a route assertion that /loops?view=scheduled renders Scheduled while /loops?view=operations still renders the existing operations dashboard.

- [ ] **Step 2: Run tests and verify they fail**

Run: pnpm --filter @repo/web exec vitest run components/workbench/scheduled-issues-workbench.test.tsx app/loops/page.test.tsx components/layout/app-navbar.test.tsx

Expected: FAIL because only conversation and operations route modes exist.

- [ ] **Step 3: Implement client-side filtering and route selection**

```tsx
const [search, setSearch] = useState('');
const visible = selectActionableIssues(items).filter(({ issue }) =>
  (issue.title + ' ' + issue.id).toLowerCase().includes(search.trim().toLowerCase()),
);

if (view === 'scheduled') return <ScheduledIssuesWorkbench />;
if (view === 'operations') return <LoopsOperationsDashboard />;
return <LoopsConversationWorkbench />;
```

The navbar search control routes to ?view=scheduled#scheduled-search and focuses the local input. Do not create a global search endpoint or claim server-side filtering. Retain loop-command-input, review-inbox, and agent-runtime anchors.

- [ ] **Step 4: Run focused tests**

Run: pnpm --filter @repo/web exec vitest run components/workbench/scheduled-issues-workbench.test.tsx app/loops/page.test.tsx components/layout/app-navbar.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit the Scheduled slice**

```bash
git add apps/web/components/workbench/scheduled-issues-workbench.tsx apps/web/components/workbench/scheduled-issues-workbench.test.tsx apps/web/app/loops/page.tsx apps/web/app/loops/page.test.tsx apps/web/components/layout/app-navbar.tsx apps/web/components/layout/app-navbar.test.tsx apps/web/locales/zh-CN/loops.json apps/web/locales/en/loops.json
git commit -m "feat: add scheduled issue workbench"
```

### Task 7: Reframe New Task And Issue Detail

**Files:**

- Modify: apps/web/app/loops/new/page.tsx
- Modify: apps/web/app/loops/new/page.test.tsx
- Modify: apps/web/app/loops/new/simple-loop-issue-form.tsx
- Modify: apps/web/app/loops/new/simple-loop-issue-form.test.tsx
- Modify: apps/web/app/loops/[issueId]/page.tsx
- Modify: apps/web/app/loops/[issueId]/page.test.tsx
- Modify: apps/web/app/loops/[issueId]/issue-detail-tabs.tsx
- Modify: apps/web/app/loops/[issueId]/issue-detail-tabs.test.tsx

- [ ] **Step 1: Add failing request-first and detail-header tests**

```tsx
expect(screen.getByRole('heading', { name: '新建任务' })).toBeInTheDocument();
expect(screen.getByLabelText('描述要执行的工作')).toHaveFocus();
expect(screen.getByText('准备好的 Issue')).toBeInTheDocument();

expect(screen.getByRole('button', { name: /继续推进 Loop/ })).toBeInTheDocument();
expect(screen.getByRole('complementary', { name: '交付追踪' })).toBeInTheDocument();
expect(screen.getByRole('tab', { name: '概览' })).toHaveAttribute('aria-selected', 'true');
```

Keep tests for tenant context, advanced overrides, tab hash behavior, SSE updates, and delivery evidence. Add assertions rather than replacing those contracts.

- [ ] **Step 2: Run request and detail tests and verify they fail**

Run: pnpm --filter @repo/web exec vitest run app/loops/new/page.test.tsx app/loops/new/simple-loop-issue-form.test.tsx "app/loops/[issueId]/page.test.tsx" "app/loops/[issueId]/issue-detail-tabs.test.tsx"

Expected: FAIL because the pages do not render task-first labels or the B2 rail.

- [ ] **Step 3: Apply presentation-only task-first composition**

```tsx
<header>
  <Link href="/loops?view=scheduled">{t('back')}</Link>
  <h1>{detail.issue.title}</h1>
  <ContinueLoopAction detail={detail} />
</header>
<IssueDetailTabs labels={tabLabels}>{tabPanels}</IssueDetailTabs>
<TaskContextRail {...getDetailContext(detail, runtime, evidence, advanceStatus)} />
```

Make the request field lead the new-task route and one Continue Loop action lead detail. Do not change normalisation, tenant lookup, action sequencing, tab anchor mapping, or delivery evidence query behavior.

- [ ] **Step 4: Run detail and intake tests**

Run: pnpm --filter @repo/web exec vitest run app/loops/new/page.test.tsx app/loops/new/simple-loop-issue-form.test.tsx "app/loops/[issueId]/page.test.tsx" "app/loops/[issueId]/issue-detail-tabs.test.tsx"

Expected: PASS with existing action and evidence assertions retained.

- [ ] **Step 5: Commit the task-page slice**

```bash
git add apps/web/app/loops/new apps/web/app/loops/[issueId]
git commit -m "feat: make task creation and detail workbench-first"
```

### Task 8: Focus Review, Runtime, Operations, And Settings

**Files:**

- Modify: apps/web/app/loops/loops-operations-view.tsx
- Modify: apps/web/app/loops/loops-issues-view.tsx
- Modify: apps/web/app/loops/loops-issues-view.test.tsx
- Modify: apps/web/app/loops/agent-runtime/page.tsx
- Modify: apps/web/app/loops/agent-runtime/page.test.tsx
- Modify: apps/web/app/[locale]/settings/page.tsx
- Modify: apps/web/app/[locale]/settings/page.test.tsx
- Modify: apps/web/locales/zh-CN/loops.json
- Modify: apps/web/locales/en/loops.json

- [ ] **Step 1: Add failing management-surface tests**

```tsx
expect(screen.getByRole('heading', { name: '运营' })).toBeInTheDocument();
expect(screen.getByText('审查队列')).toBeInTheDocument();
expect(screen.getByText('Agents')).toBeInTheDocument();
expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument();
```

Assert that an operations hash opens the relevant existing section and that the agent-runtime compatibility route still redirects to the canonical runtime anchor.

- [ ] **Step 2: Run management tests and verify they fail**

Run: pnpm --filter @repo/web exec vitest run app/loops/loops-issues-view.test.tsx app/loops/agent-runtime/page.test.tsx "app/[locale]/settings/page.test.tsx"

Expected: FAIL because management sections use legacy card styling and lack named Review and Runtime group headers.

- [ ] **Step 3: Reorganize existing surfaces without deleting data**

```tsx
<LoopsOperationsView>
  <section aria-labelledby="review-inbox-title" id="review-inbox">
    <ReviewInbox />
  </section>
  <section aria-labelledby="agent-runtime-title" id="agent-runtime">
    <RuntimePanel />
  </section>
  <details>
    <summary>{t('operations.trigger')}</summary>
    {remainingOperatorSections}
  </details>
</LoopsOperationsView>
```

Use compact rows and readable error/retry treatment for Review and Runtime. Keep all existing dashboard content under Operations and retain every existing anchor. Settings remains inside AppShell and exposes account, locale, and readable workspace context only; do not add a preference mutation.

- [ ] **Step 4: Run management tests**

Run: pnpm --filter @repo/web exec vitest run app/loops/loops-issues-view.test.tsx app/loops/agent-runtime/page.test.tsx "app/[locale]/settings/page.test.tsx"

Expected: PASS with route compatibility assertions preserved.

- [ ] **Step 5: Commit the management slice**

```bash
git add apps/web/app/loops/loops-operations-view.tsx apps/web/app/loops/loops-issues-view.tsx apps/web/app/loops/loops-issues-view.test.tsx apps/web/app/loops/agent-runtime apps/web/app/[locale]/settings apps/web/locales/zh-CN/loops.json apps/web/locales/en/loops.json
git commit -m "feat: focus review runtime and settings surfaces"
```

### Task 9: Add Authenticated Browser Coverage And Verify The Release Slice

**Files:**

- Modify: apps/web/e2e/workbench-navigation.spec.ts
- Modify: apps/web/e2e/sso-real.spec.ts
- Modify: docs/superpowers/specs/2026-07-14-vibecoding-authenticated-workbench-design.md

- [ ] **Step 1: Write failing authenticated navigation cases**

```ts
test('Chinese desktop workbench reaches Scheduled, workspace conversation, More runtime, and Settings', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: '已安排' }).click();
  await expect(page).toHaveURL(/view=scheduled/);
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('link', { name: '运行时' }).click();
  await expect(page).toHaveURL(/view=operations#agent-runtime/);
});
```

Add a 320px case that opens the drawer and context trigger, and a 1440px case that asserts document.body.scrollWidth is not greater than window.innerWidth.

- [ ] **Step 2: Run browser tests and verify they fail**

Run: pnpm --filter @repo/web exec playwright test e2e/workbench-navigation.spec.ts

Expected: FAIL until S1 labels and the Scheduled route exist.

- [ ] **Step 3: Implement only test accommodations required by approved UI**

Keep the synthetic authenticated cookie setup in workbench-navigation.spec.ts. Do not weaken the real SSO test: retain its opt-in environment guard and callback, refresh, and logout assertions. Add no production authentication bypass.

- [ ] **Step 4: Run the complete validation set**

```bash
pnpm --filter @repo/web exec vitest run components/workbench components/layout app/loops "app/[locale]/settings"
pnpm --filter @repo/web type-check
pnpm --filter @repo/web lint
pnpm --filter @repo/web exec playwright test e2e/workbench-navigation.spec.ts
pnpm quality:gate
```

Expected: all selected tests, type check, browser checks, and quality gate pass. Report pre-existing lint warnings separately.

- [ ] **Step 5: Capture visual evidence and commit verification updates**

Capture 320px, 1024px, and 1440px screenshots for Home, Workspace, Issue detail, Review/Runtime, and Settings. Update the design spec's usability-validation status with test dates and outcomes, then commit only E2E and documentation changes.

```bash
git add apps/web/e2e/workbench-navigation.spec.ts apps/web/e2e/sso-real.spec.ts docs/superpowers/specs/2026-07-14-vibecoding-authenticated-workbench-design.md
git commit -m "test: cover authenticated workbench navigation"
```

## Plan Self-Review

| Design requirement                                                      | Covered by           |
| ----------------------------------------------------------------------- | -------------------- |
| S1 workspace-first navigation and More menu                             | Tasks 1 and 3        |
| B2 delivery context rail                                                | Tasks 2, 5, and 7    |
| H1 plus H3 resume-plus-inbox home                                       | Task 4               |
| Conversation-created Issue                                              | Tasks 2 and 5        |
| Scheduled and search task discovery                                     | Task 6               |
| Request-first new task and task-first Issue detail                      | Task 7               |
| Review, runtime, operations, settings, and anchors                      | Task 8               |
| Chinese default, responsive, accessibility, error states, browser proof | Tasks 2 through 9    |
| No API, auth, tenant, or database contract changes                      | Tasks 1, 5, 7, and 9 |

The plan introduces no new backend endpoint, persistence model, workspace mutation, or unbounded dashboard rewrite. Each commit is scoped to one working vertical slice. Existing user modifications to apps/web/app/loops/page.tsx and apps/web/app/loops/page.test.tsx must be read and incorporated rather than reset before Task 5 or Task 6 begins.
