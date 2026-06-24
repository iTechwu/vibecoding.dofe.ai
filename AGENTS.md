# AGENTS.md

Entry point for Codex and other coding agents working in `vibecoding.dofe.ai`.
Keep this file short; route detailed reading by task.

## Project Role

`vibecoding.dofe.ai` owns issue-to-implementation loops, coding workflow
orchestration, review evidence, execution UX, and the operator loop dashboard.

For cross-project ownership, read:

- [Dofe Project Matrix](../docs/PROJECT-MATRIX.md)
- [CLAUDE.md](./CLAUDE.md) for full local conventions when needed

## Red Lines

- Early MVP flows should stay simple: Web issue intake and SSO are primary unless
  a task explicitly asks for heavier external intake integrations.
- Loop default user paths should use product-level actions such as
  `Continue Loop`; granular internal stages belong in compatible APIs or
  operator diagnostics.
- DB access must go through the DB service layer; do not use raw
  `prisma.write` / `prisma.read` in API or service code.
- API contracts and external interfaces must be Zod-first and ts-rest aligned.
- External API calls belong in client-layer code, not directly in business
  services.
- Consume SSO/models/infra through their published APIs or packages; do not copy
  ownership into this repo.

## Task Routing

| Task                              | Read First                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| Loop product flow or dashboard    | `CLAUDE.md`, relevant `docs/0622` or `docs/0623` plan, affected page/service/tests |
| Frontend UI or interaction        | `CLAUDE.md`, affected page/component, related tests                                |
| API or contract changes           | `CLAUDE.md`, `packages/contracts`, controller/service, related tests               |
| DB or Prisma changes              | `CLAUDE.md`, Prisma schema, DB service code, related tests                         |
| Cross-project dependency behavior | [Dofe Project Matrix](../docs/PROJECT-MATRIX.md)                                   |

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm type-check
pnpm test
pnpm quality:gate
```

Use focused package commands while iterating; use `pnpm quality:gate` before
shipping loop-engineer, cross-boundary, or release-facing changes.

## Completion

- Keep changes scoped to the requested loop/product surface.
- Treat docs as implementation state: update them when task acceptance depends
  on a plan, gap list, or loop status.
- Run the narrowest meaningful validation first, then `pnpm quality:gate` for
  release-facing or architecture-affecting changes.
- Report unrelated existing worktree changes without reverting them.
