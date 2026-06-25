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

section "Infra exact version boundary"
if node <<'NODE'
const fs = require('fs');
const path = require('path');
const expected = '0.1.78';
const ignored = new Set(['node_modules', '.git', 'dist', '.next', 'coverage', '.turbo']);
const bad = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (entry.name !== 'package.json') continue;
    const json = JSON.parse(fs.readFileSync(full, 'utf8'));
    const rel = path.relative(process.cwd(), full);
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, version] of Object.entries(json[section] || {})) {
        if (name.startsWith('@dofe/infra-') && version !== expected) {
          bad.push(`${rel} ${section}.${name}=${version}`);
        }
      }
    }
    for (const [name, version] of Object.entries(json.pnpm?.overrides || {})) {
      if (name.startsWith('@dofe/infra-') && version !== expected) {
        bad.push(`${rel} pnpm.overrides.${name}=${version}`);
      }
    }
  }
}

walk(process.cwd());
if (bad.length > 0) {
  console.error(`FAIL: @dofe/infra-* direct versions must be exact ${expected}`);
  for (const item of bad) console.error(item);
  process.exit(1);
}
console.log(`PASS: @dofe/infra-* direct versions are exact ${expected}`);
NODE
then
  :
else
  failures=$((failures + 1))
fi

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

section "Package infra constants boundary"
check_no_matches \
  "migrated packages must not reintroduce @repo/constants; shared constants should come from @dofe/infra-contracts or stay in the owning app/domain" \
  "@repo/constants" \
  packages/ui packages/utils packages/contracts \
  --glob '*.{ts,tsx,js,mjs,json}'

section "UI infra utils boundary"
check_no_matches \
  "packages/ui must not reintroduce @repo/utils; use @dofe/infra-web-runtime/cn for shared UI className helpers" \
  "@repo/utils" \
  packages/ui \
  --glob '*.{ts,tsx,js,mjs,json}'

section "Web infra utils root boundary"
check_no_matches \
  "Frontend code must not import from @dofe/infra-utils root export; use browser-safe subpaths only" \
  "from ['\"]@dofe/infra-utils['\"]|import\\(['\"]@dofe/infra-utils['\"]\\)" \
  apps/web \
  --glob '*.{ts,tsx}'

section "SSO token contracts publish boundary"
if node <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const failures = [];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json']);
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.next', 'coverage'].includes(entry.name)) walk(full);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;
    const content = fs.readFileSync(full, 'utf8');
    if (
      /from\s+['"]@dofe\/sso-contracts\/token['"]/.test(content) ||
      /import\(\s*['"]@dofe\/sso-contracts\/token['"]\s*\)/.test(content)
    ) {
      failures.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
}
walk(path.join(root, 'apps/api'));
walk(path.join(root, 'apps/web'));
let tokenExportAvailable = true;
try {
  require.resolve('@dofe/sso-contracts/token', { paths: [root] });
} catch {
  tokenExportAvailable = false;
}
if (!tokenExportAvailable && failures.length > 0) {
  console.error('FAIL: @dofe/sso-contracts/token is not exported by the installed npm package yet');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log('PASS: no premature @dofe/sso-contracts/token imports before npm export is available');
NODE
then
  :
else
  failures=$((failures + 1))
fi

section "Web repo utils narrow boundary"
check_no_matches \
  "Frontend code may only keep @repo/utils/headers until GAP-007 is resolved" \
  "from ['\"]@repo/utils['\"]|from ['\"]@repo/utils/(?!headers['\"])|import\\(['\"]@repo/utils(/(?!headers['\"])[^'\"]*)?['\"]\\)" \
  apps/web \
  --glob '*.{ts,tsx}'

if [ "$failures" -gt 0 ]; then
  printf '\nArchitecture check failed with %s failing section(s).\n' "$failures"
  exit 1
fi

printf '\nArchitecture check passed.\n'
