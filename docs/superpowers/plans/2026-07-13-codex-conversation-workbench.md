# Codex Conversation Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/loops` the authenticated conversational workbench where one submitted request creates and follows a Loops Issue.

**Architecture:** Preserve all Loops APIs and state-machine behavior. Replace the dashboard-first `/loops` composition with focused presentational components that consume the existing list, simple-intake, tenant, and SSE hooks. The global shell becomes the persistent project navigator; its compact bottom “More” menu exposes Runtime and Settings without surfacing operator controls in the default task flow.

**Tech Stack:** Next.js App Router, React 19, TypeScript, next-intl, TanStack Query, ts-rest hooks, Tailwind/shadcn primitives, Vitest.

---

### Task 1: Create The Conversation Workspace

**Files:**

- Create: `apps/web/components/workbench/loops-conversation-workbench.tsx`
- Create: `apps/web/components/workbench/loops-conversation-workbench.test.tsx`
- Modify: `apps/web/components/index.ts`

- [ ] **Step 1: Write the failing component tests**

```tsx
it('creates one simple issue from a sent request and opens the new issue', async () => {
  renderWorkbench();
  await user.type(
    screen.getByLabelText('Describe the work to run'),
    'Improve the checkout error path',
  );
  await user.click(screen.getByRole('button', { name: 'Send request' }));
  expect(createIssue).toHaveBeenCalledWith({
    body: expect.objectContaining({ request: 'Improve the checkout error path' }),
  });
  expect(push).toHaveBeenCalledWith('/loops/issue-new');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @repo/web exec vitest run components/workbench/loops-conversation-workbench.test.tsx`

Expected: FAIL because `LoopsConversationWorkbench` does not exist.

- [ ] **Step 3: Implement the data-backed conversation surface**

```tsx
const issues = listQuery.data?.body.data.list ?? [];
const submit = async () => {
  const result = await createIssue.mutateAsync({ body: { request: value.trim() } });
  router.push(`/loops/${result.body.data.issue.id}`);
};
```

Render existing issues as user-request messages plus compact system status replies. Use `useLoopAdvanceSSE` only for the selected issue and keep the composer keyboard accessible (`Enter` sends, `Shift+Enter` adds a newline).

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter @repo/web exec vitest run components/workbench/loops-conversation-workbench.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the vertical slice**

```bash
git add apps/web/components/workbench/loops-conversation-workbench.tsx apps/web/components/workbench/loops-conversation-workbench.test.tsx apps/web/components/index.ts
git commit -m "feat: add loops conversation workspace"
```

### Task 2: Simplify The Authenticated Shell Navigation

**Files:**

- Modify: `apps/web/components/layout/app-sidebar.tsx`
- Modify: `apps/web/components/layout/app-navbar.tsx`
- Modify: `apps/web/components/layout/app-sidebar.test.tsx`
- Modify: `apps/web/components/layout/app-navbar.test.tsx`
- Modify: `apps/web/locales/zh-CN/navigation.json`
- Modify: `apps/web/locales/en/navigation.json`

- [ ] **Step 1: Write failing navigation tests**

```tsx
expect(screen.getByText('Projects')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
expect(screen.getByText('Team: Dofe')).toBeInTheDocument();
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @repo/web exec vitest run components/layout/app-sidebar.test.tsx components/layout/app-navbar.test.tsx`

Expected: FAIL because the shell still exposes the legacy dashboard navigation.

- [ ] **Step 3: Implement project-first navigation**

```tsx
<SidebarGroupLabel>{t('groupProjects')}</SidebarGroupLabel>
<SidebarMenuButton asChild isActive={pathname === '/loops'}>
  <Link href="/loops"><MessageSquare />{t('menu.workspace')}</Link>
</SidebarMenuButton>
<DropdownMenuItem asChild><Link href="/loops/agent-runtime">...</Link></DropdownMenuItem>
```

Keep account actions at the footer. Put Runtime, Settings, and the compatibility issue-management surface under the More menu. In the navbar, show current team/workspace and user identity instead of duplicate navigation.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter @repo/web exec vitest run components/layout/app-sidebar.test.tsx components/layout/app-navbar.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the vertical slice**

```bash
git add apps/web/components/layout apps/web/locales/zh-CN/navigation.json apps/web/locales/en/navigation.json
git commit -m "feat: make the workbench shell project-first"
```

### Task 3: Route `/loops` To The Conversation Workspace

**Files:**

- Modify: `apps/web/app/loops/page.tsx`
- Modify: `apps/web/app/loops/page.test.tsx`
- Modify: `docs/0622/loop-engineer/README.md`

- [ ] **Step 1: Replace dashboard assertions with conversation-flow assertions**

```tsx
it('renders the conversation composer as the primary loops interaction', () => {
  renderWithIntl(<LoopsPage />);
  expect(screen.getByRole('textbox', { name: 'Describe the work to run' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx`

Expected: FAIL because `/loops` still renders the dashboard-first implementation.

- [ ] **Step 3: Delegate the route to the workspace**

```tsx
import { LoopsConversationWorkbench } from '@/components/workbench';

export default function LoopsPage() {
  return <LoopsConversationWorkbench />;
}
```

Keep the existing dashboard-model and operator surfaces untouched for later migration; only the default route changes in this slice.

- [ ] **Step 4: Run route and component tests**

Run: `pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx components/workbench/loops-conversation-workbench.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the integration slice**

```bash
git add apps/web/app/loops/page.tsx apps/web/app/loops/page.test.tsx docs/0622/loop-engineer/README.md
git commit -m "feat: make conversation the loops default"
```

### Task 4: Verify The Workbench

**Files:**

- Modify: `docs/0622/loop-engineer/04-implementation-roadmap.md`

- [ ] **Step 1: Run focused Web tests**

Run: `pnpm --filter @repo/web exec vitest run components/workbench/loops-conversation-workbench.test.tsx components/layout/app-sidebar.test.tsx components/layout/app-navbar.test.tsx app/loops/page.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run static validation**

Run: `pnpm --filter @repo/web type-check && pnpm --filter @repo/web lint && pnpm quality:gate`

Expected: zero errors; report pre-existing warnings separately.

- [ ] **Step 3: Update implementation evidence**

Record that `/loops` is now the conversation-first default and that Runtime/Settings remain reachable via the More menu.

- [ ] **Step 4: Commit verification evidence**

```bash
git add docs/0622/loop-engineer/04-implementation-roadmap.md
git commit -m "docs: record conversation workbench rollout"
```
