#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0
warnings=0

section() {
  printf '\n== %s ==\n' "$1"
}

check_no_matches() {
  local label="$1"
  local pattern="$2"
  shift 2
  local tmp
  tmp="$(mktemp)"

  if rg -n "$pattern" "$@" >"$tmp" 2>/dev/null; then
    echo "FAIL: $label"
    cat "$tmp"
    failures=$((failures + 1))
  else
    echo "PASS: $label"
  fi

  rm -f "$tmp"
}

report_matches() {
  local label="$1"
  local pattern="$2"
  shift 2
  local tmp
  tmp="$(mktemp)"

  if rg -n "$pattern" "$@" >"$tmp" 2>/dev/null; then
    local count
    count="$(wc -l <"$tmp" | tr -d ' ')"
    echo "WARN: $label ($count match(es))"
    cat "$tmp"
    warnings=$((warnings + 1))
  else
    echo "PASS: $label"
  fi

  rm -f "$tmp"
}

section "DB client boundary"
check_no_matches \
  "Service/API/domain files must not call getReadClient/getWriteClient directly" \
  "get(Read|Write)Client\\(" \
  apps/api/src apps/api/libs/domain \
  --glob '*.ts' \
  --glob '!**/*.spec.ts' \
  --glob '!**/*.test.ts'

section "Logger boundary"
check_no_matches \
  "Production backend code should not use Nest built-in Logger" \
  "import .*Logger.*from '@nestjs/common'|new Logger\\(" \
  apps/api/src apps/api/libs/domain \
  --glob '*.ts' \
  --glob '!**/*.spec.ts' \
  --glob '!**/*.test.ts'

section "Console usage"
check_no_matches \
  "Production code should not use console.*" \
  "^[[:space:]]*[^*/[:space:]].*console\\.(log|error|warn|debug|info)\\(" \
  apps/api/src apps/api/libs/domain apps/web/app apps/web/components apps/web/lib apps/web/hooks \
  --glob '*.ts' \
  --glob '*.tsx' \
  --glob '!**/*.spec.ts' \
  --glob '!**/*.test.ts' \
  --glob '!**/__tests__/**'

section "Any usage"
check_no_matches \
  "Production code should not add as any or : any" \
  "^[[:space:]]*[^*/[:space:]].*(as any|: any)" \
  apps/api/src apps/api/libs/domain apps/web/app apps/web/components apps/web/lib apps/web/hooks packages/contracts/src \
  --glob '*.ts' \
  --glob '*.tsx' \
  --glob '!**/*.spec.ts' \
  --glob '!**/*.test.ts' \
  --glob '!**/__tests__/**'

if [ "$failures" -gt 0 ]; then
  printf '\nArchitecture check failed with %s failing section(s).\n' "$failures"
  exit 1
fi

printf '\nArchitecture check passed.\n'
