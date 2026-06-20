#!/usr/bin/env bash
set -euo pipefail

pnpm quality:gate

pnpm --filter @repo/api type-check
pnpm --filter @repo/web type-check

pnpm --filter @repo/contracts typecheck
pnpm --filter @repo/contracts test

pnpm --filter @repo/utils typecheck
pnpm --filter @repo/utils test

pnpm --filter @repo/validators test
pnpm --filter @repo/web test

pnpm --filter @repo/api exec jest src/bootstrap/i18n.bootstrap.spec.ts --runInBand
pnpm --filter @repo/api exec jest src/bootstrap/app-module-imports.bootstrap.spec.ts --runInBand
pnpm --filter @repo/api exec jest src/modules/loops --runInBand

pnpm loops:doctor
pnpm loops:db-doctor

if [[ "${LOOPS_DB_SMOKE:-}" == "1" ]]; then
  pnpm --filter @repo/api exec jest src/modules/loops/loops-persistence.db.spec.ts --runInBand
fi

pnpm build
