# Loops Production Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Loops operational verification, remove vulnerable production dependency resolutions, and prevent CLI-agent failures from being represented as successful deterministic delivery.

**Architecture:** Keep the CLI as a thin composition root over the domain services, enforce vulnerable package floors through workspace overrides, and make CLI agent adapters fail explicitly in CLI mode. The deterministic adapters remain the explicit default for development and tests.

**Tech Stack:** pnpm overrides, Node test runner, Jest, NestJS domain services, Zod.

---

### Task 1: Restore Loops CLI Composition

**Files:**

- Modify: `scripts/loops-cli.ts`
- Create: `scripts/loops-cli.test.mjs`
- Modify: `package.json`

- [x] Write a Node regression that executes `pnpm loops:status`, requires exit code zero, and parses the JSON queue summary.
- [x] Run the regression and confirm it fails because the CLI imports removed `src/modules/loops` files.
- [x] Replace each removed import with its domain-service export and update the optional DB persistence import.
- [x] Add the regression to `check:docs0629-tools` so `quality:gate` exercises the operational CLI.
- [x] Run `pnpm loops:status`, `pnpm loops:doctor`, and the new Node test.

### Task 2: Pin Vulnerable Production Transitives

**Files:**

- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`

- [x] Record the failing audit as the reproduction: `protobufjs@7.2.5` and `axios@0.21.4/0.27.2` enter through Volcengine SDKs.
- [x] Add narrow workspace overrides to patched, compatible package versions.
- [x] Run `pnpm install --lockfile-only` to resolve the lockfile.
- [x] Verify `pnpm why` resolves `axios@1.18.1`, `protobufjs@7.6.5`, and `nodemailer@9.0.3`; then pin `@hono/node-server@1.19.13`, `postcss@8.5.16`, `fast-xml-parser@5.9.3`, `uuid@11.1.1`, and `js-yaml@4.2.0`. `pnpm audit --prod --audit-level moderate --json` now reports zero advisories at every severity.

### Task 3: Fail Closed In Real CLI Mode

**Files:**

- Modify: `apps/api/libs/domain/services/loops-runners/adapters/cli-loops-agent.adapter.ts`
- Modify: `apps/api/libs/domain/services/loops-runners/adapters/cli-loops-claude.adapter.ts`
- Test: adapter Jest specifications beside each adapter

- [x] Add a failing test that a final CLI failure rejects instead of returning deterministic implementation/review output.
- [x] Run the focused Jest specifications and confirm the fallback behavior makes the test fail.
- [x] Replace the final fallback with an explicit operational error while preserving retry attempts and successful CLI parsing.
- [x] Run focused Jest, API type-check, and the full API test suite.

### Task 4: Verify And Record Residual Production Work

**Files:**

- Modify: `docs/0712/uiux-opz/issue-runtime-e2e-review.md` only if a repository-owned acceptance status changes

- [x] Run `pnpm quality:gate`, `pnpm build`, and Web Playwright E2E (4 passed, 1 real-SSO test skipped without external credentials).
- [x] Implement asynchronous `advance` scheduling through a single-concurrency BullMQ worker with retry/backoff, active-job deduplication, and fail-closed queue availability. Persist lifecycle status in Redis; validate active-worker recovery by force-closing a real BullMQ worker and having a replacement reclaim the job after its Redis lock expires; expose the latest status through `GET /issues/:issueId/advance-status` and a scope-protected SSE stream at `GET /issues/:issueId/advance-events`. The real SSO scope allowlist remains an external follow-up.
