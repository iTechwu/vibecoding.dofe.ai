# AGENTS.md

This file provides guidance to AI coding agents (Codex, Cursor, Copilot, etc.) when working with code in this repository.

> **Note**: The canonical and most up-to-date guidance is in [CLAUDE.md](./CLAUDE.md). This file serves as an entry point for agents that look for `AGENTS.md` by convention. Both files contain equivalent architectural rules and coding standards.

## Quick Reference

This project is a **full-stack monorepo** (pnpm workspaces + Turborepo) containing:

- **apps/web/** — Next.js 16 frontend (React 19, App Router, Tailwind CSS 4)
- **apps/api/** — NestJS 11 backend (Fastify, Prisma, PostgreSQL)
- **packages/** — Shared packages (ui, utils, types, config, constants, validators, contracts)

## ⚠️ Core Architecture Rules

Before making ANY code changes, you MUST follow these rules:

1. **Database access ONLY through DB Service layer** — Never use `prisma.write`/`prisma.read` directly in API or Service layers
2. **Zod-first validation** — All API requests/responses must use Zod schemas (via ts-rest contracts)
3. **External API calls ONLY through Client layer** — Service layer must call Client layer, not external APIs directly
4. **Winston Logger only** — No NestJS built-in Logger, no `console.log` in production code

## Required Reading

Before coding, read the full guidance in [CLAUDE.md](./CLAUDE.md), which covers:

- Monorepo structure and import aliases
- API list standardization pattern (PaginationQuerySchema / PaginatedResponseSchema)
- Zod 4 usage guidelines
- Architecture layering with concrete code examples
- Environment variables and configuration

## Quick Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all apps and packages
pnpm lint             # Lint all packages
pnpm type-check       # Type-check all packages
pnpm test             # Run all tests
pnpm quality:gate     # Run architecture + code quality checks
```

## Code Quality

- Pre-commit hooks (Husky + lint-staged) enforce ESLint and Prettier on staged files
- CI pipeline enforces lint, type-check, quality gate, tests, and security audit
- Quality gate scripts run architecture boundary checks, API standardization checks, and sensitive data detection
