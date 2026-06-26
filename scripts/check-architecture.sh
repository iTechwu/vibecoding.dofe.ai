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

section "PNPM workspace policy boundary"
if node <<'NODE'
const fs = require('fs');
const path = require('path');
const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const workspace = fs.readFileSync('pnpm-workspace.yaml', 'utf8');
const failures = [];

if (rootPackage.packageManager !== 'pnpm@11.7.0') {
  failures.push('package.json packageManager must stay pnpm@11.7.0');
}
if (rootPackage.pnpm) {
  failures.push('package.json must not define pnpm settings; use pnpm-workspace.yaml for pnpm 11');
}
for (const marker of ['overrides:', 'patchedDependencies:', 'peerDependencyRules:', 'allowBuilds:', 'minimumReleaseAgeExclude:', "'@scarf/scarf': false"]) {
  if (!workspace.includes(marker)) {
    failures.push(`pnpm-workspace.yaml must include ${marker}`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: pnpm workspace policy must stay in pnpm-workspace.yaml');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('PASS: pnpm 11 workspace policy is active');
NODE
then
  :
else
  failures=$((failures + 1))
fi

section "SSO SDK exact version boundary"
if node <<'NODE'
const fs = require('fs');
const path = require('path');
const expected = {
  '@dofe/sso-contracts': '0.1.71',
  '@dofe/sso-node': '0.1.58',
  '@dofe/sso-nestjs': '0.1.57',
  '@dofe/sso-browser': '0.1.78',
  '@dofe/sso-hooks': '0.1.59',
  '@dofe/sso-ui': '0.1.58',
};
const ignored = new Set(['node_modules', '.git', 'dist', '.next', 'coverage', '.turbo']);
const failures = [];

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
        if (expected[name] && version !== expected[name]) {
          failures.push(`${rel} ${section}.${name} must be exact ${expected[name]}, found ${version}`);
        }
      }
    }
  }
}

walk(process.cwd());
if (failures.length > 0) {
  console.error('FAIL: @dofe/sso-* direct versions must match current latest baseline');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('PASS: @dofe/sso-* direct versions match current latest baseline');
NODE
then
  :
else
  failures=$((failures + 1))
fi

section "OIDC RP legacy dependency boundary"
if node <<'NODE'
const fs = require('fs');
const path = require('path');
const expectedOpenidClientVersion = '6.8.4';
const ignored = new Set(['node_modules', '.git', 'dist', '.next', 'coverage', '.turbo']);
const failures = [];

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
        if (name === 'openid-client' && version !== expectedOpenidClientVersion) {
          failures.push(
            `${rel} ${section}.openid-client must be exact ${expectedOpenidClientVersion} while F.1 OIDC RP remains hand-rolled, found ${version}`,
          );
        }
      }
    }
  }
}

walk(process.cwd());
if (failures.length > 0) {
  console.error('FAIL: openid-client must stay exact while F.1 OIDC RP parity is pending');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`PASS: openid-client direct versions are exact ${expectedOpenidClientVersion}`);
NODE
then
  :
else
  failures=$((failures + 1))
fi

section "File SDK web signal cast boundary"
if node <<'NODE'
const fs = require('fs');
const path = require('path');
const expectedFileSdkWebVersion = '0.1.12';
const packageFile = path.join(process.cwd(), 'apps/web/package.json');
const uploaderFile = path.join(process.cwd(), 'apps/web/lib/upload/uploader.ts');
const failures = [];

if (fs.existsSync(packageFile) && fs.existsSync(uploaderFile)) {
  const webPackage = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const fileSdkWebVersion = webPackage.dependencies?.['@dofe/file-sdk-web'];
  const content = fs.readFileSync(uploaderFile, 'utf8');
  const hasTemporaryCast =
    /type\s+UploadOptionsWithSignal\s*=/.test(content) &&
    /signal:\s*AbortSignal\s*[;}]/.test(content) &&
    /&\s*\{[^}]*signal/.test(content);
  const hasVersionComment =
    content.includes('@dofe/file-sdk-web@0.1.12') &&
    content.includes('@dofe/file-sdk-web@0.1.13+');

  if (fileSdkWebVersion === expectedFileSdkWebVersion) {
    if (!hasTemporaryCast || !hasVersionComment) {
      failures.push(
        `apps/web/lib/upload/uploader.ts must keep the documented UploadOptionsWithSignal temporary cast while @dofe/file-sdk-web is pinned to ${expectedFileSdkWebVersion}`,
      );
    }
  } else if (fileSdkWebVersion && hasTemporaryCast) {
    failures.push(
      `apps/web/lib/upload/uploader.ts still has UploadOptionsWithSignal after @dofe/file-sdk-web moved away from ${expectedFileSdkWebVersion}; remove the temporary cast and use SDK UploadOptions.signal`,
    );
  }
}

if (failures.length > 0) {
  console.error('FAIL: file-sdk-web signal cast boundary failed');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('PASS: file-sdk-web signal cast boundary is consistent with pinned SDK version');
NODE
then
  :
else
  failures=$((failures + 1))
fi

section "Controlled legacy lockfile pin boundary"
if node <<'NODE'
const fs = require('fs');
const path = require('path');
const expectedFileSdkWebVersion = '0.1.12';
const expectedOpenidClientVersion = '6.8.4';
const lockfile = path.join(process.cwd(), 'pnpm-lock.yaml');
const failures = [];

function readDependency(relativePath, packageName) {
  const packageFile = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(packageFile)) return undefined;

  const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  return pkg.dependencies?.[packageName] ?? pkg.devDependencies?.[packageName];
}

if (fs.existsSync(lockfile)) {
  const content = fs.readFileSync(lockfile, 'utf8');
  const fileSdkWebVersion = readDependency('apps/web/package.json', '@dofe/file-sdk-web');
  if (
    fileSdkWebVersion === expectedFileSdkWebVersion &&
    !content.includes(`'@dofe/file-sdk-web@${expectedFileSdkWebVersion}'`)
  ) {
    failures.push(
      `pnpm-lock.yaml must keep @dofe/file-sdk-web pinned to ${expectedFileSdkWebVersion} until @dofe/file-sdk-web@0.1.13+ is published and the upload cast is removed`,
    );
  }

  if (
    readDependency('apps/api/package.json', 'openid-client') &&
    !content.includes(`openid-client@${expectedOpenidClientVersion}:`)
  ) {
    failures.push(
      `pnpm-lock.yaml must keep openid-client pinned to ${expectedOpenidClientVersion} while F.1 OIDC RP remains hand-rolled`,
    );
  }
}

if (failures.length > 0) {
  console.error('FAIL: controlled legacy lockfile pins must stay exact');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('PASS: controlled legacy lockfile pins are exact');
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

section "Infra config boundary"
check_no_matches \
  "Local @repo/config or @repo/infra-config must not be reintroduced; use @dofe/infra-config for shared tsconfig/eslint/postcss/prettier baselines" \
  "@repo/config|@repo/infra-config|packages/config" \
  package.json apps packages scripts \
  --glob '*.{json,js,mjs,ts,tsx,md}' \
  --glob '!node_modules/**' \
  --glob '!dist/**'

section "Legacy local package README boundary"
if node <<'NODE'
const fs = require('fs');
const requiredMarkers = [
  [
    'packages/utils/README.md',
    ['legacy local package', '@dofe/infra-web-runtime/cn', '@repo/utils/headers', '@dofe/infra-utils/<name>.util'],
  ],
  ['packages/constants/README.md', ['legacy local package', '@dofe/infra-contracts', '@dofe/sso-contracts/token']],
];
const failures = [];

for (const [file, markers] of requiredMarkers) {
  if (!fs.existsSync(file)) {
    failures.push(`${file} must exist and document legacy local package boundaries`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  for (const marker of markers) {
    if (!content.includes(marker)) {
      failures.push(`${file} must include "${marker}"`);
    }
  }
  if (
    file === 'packages/constants/README.md' &&
    /after that subpath is published|once published|发布后再迁移/.test(content)
  ) {
    failures.push(`${file} must not describe @dofe/sso-contracts/token as a future publish blocker`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: legacy local package README markers are missing');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('PASS: legacy local package README markers are present');
NODE
then
  :
else
  failures=$((failures + 1))
fi

section "Contracts error re-export boundary"
if node <<'NODE'
const fs = require('fs');
const requiredFiles = [
  ['packages/contracts/src/errors/domains/common.errors.ts', 'CommonErrorCode'],
  ['packages/contracts/src/errors/domains/user.errors.ts', 'UserErrorCode'],
];
const failures = [];

for (const [file, symbol] of requiredFiles) {
  if (!fs.existsSync(file)) {
    failures.push(`${file} must exist as a compatibility re-export`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('@dofe/infra-contracts/error-codes')) {
    failures.push(`${file} must re-export ${symbol} from @dofe/infra-contracts/error-codes`);
  }
  const localDefinitionPattern = new RegExp(
    `export\\s+(?:const|enum)\\s+${symbol}\\b|${symbol}\\s*=\\s*\\{`,
  );
  if (localDefinitionPattern.test(content)) {
    failures.push(`${file} must not restore local ${symbol} definitions; keep infra re-export only`);
  }
}

const messagesFile = 'packages/contracts/src/errors/messages.ts';
if (!fs.existsSync(messagesFile)) {
  failures.push(`${messagesFile} must keep infra-backed standard error messages plus vibecoding domain extensions`);
} else {
  const content = fs.readFileSync(messagesFile, 'utf8');
  if (!content.includes("ErrorMessages as InfraErrorMessages")) {
    failures.push(`${messagesFile} must import infra ErrorMessages as the standard domain source`);
  }
  for (const domain of ['user', 'common', 'auth', 'tenant']) {
    const pattern = new RegExp(`${domain}:\\s*InfraErrorMessages\\.${domain}\\s*\\?\\?\\s*\\{\\}`);
    if (!pattern.test(content)) {
      failures.push(`${messagesFile} must keep ${domain} messages sourced from InfraErrorMessages.${domain}`);
    }
  }
  for (const domain of ['space', 'folder', 'file', 'payment']) {
    const pattern = new RegExp(`${domain}:\\s*\\{`);
    if (!pattern.test(content)) {
      failures.push(`${messagesFile} must keep local ${domain} domain extension messages`);
    }
  }
}

if (failures.length > 0) {
  console.error('FAIL: contracts error files must keep infra-backed standard domains and local extensions');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('PASS: contracts common/user error files and messages stay infra-backed');
NODE
then
  :
else
  failures=$((failures + 1))
fi

section "App repo constants residual boundary"
if node <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const allowed = new Set([
  'apps/api/package.json',
  'apps/api/tsconfig.json',
  'apps/api/test/jest-e2e.config.ts',
  'apps/web/package.json',
  'apps/web/tsconfig.json',
  'apps/web/vitest.config.ts',
  'apps/web/next.config.ts',
]);
const ignored = new Set(['node_modules', 'dist', 'coverage', '.turbo', '.next']);
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json']);
const failures = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;
    const rel = path.relative(root, full).split(path.sep).join('/');
    const content = fs.readFileSync(full, 'utf8');
    const hasRepoConstants =
      /from\s+['"]@repo\/constants['"]/.test(content) ||
      /import\(\s*['"]@repo\/constants['"]\s*\)/.test(content) ||
      /['"]@repo\/constants['"]\s*:/.test(content) ||
      /['"]@repo\/constants['"]\s*,/.test(content);
    if (hasRepoConstants && !allowed.has(rel)) {
      failures.push(rel);
    }
  }
}

walk(path.join(root, 'apps/api'));
walk(path.join(root, 'apps/web'));

if (failures.length > 0) {
  console.error(
    'FAIL: @repo/constants is only allowed for documented GAP-009/GAP-011 residues; migrate shared constants to @dofe/infra-contracts or @dofe/sso-contracts after publish',
  );
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('PASS: app @repo/constants residues are limited to package/config aliases only');
NODE
then
  :
else
  failures=$((failures + 1))
fi

section "SSO token contracts consumed boundary"
if node <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const requiredFiles = [
  'apps/api/src/modules/oidc-client-api/oidc-client-api.service.ts',
  'apps/api/libs/domain/auth/src/sso-auth-hooks.ts',
  'apps/web/app/[locale]/auth/oidc/success/page.tsx',
  'apps/web/lib/storage/index.ts',
];
const failures = [];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${file}: expected token/OIDC consumer file to exist`);
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  if (!content.includes('@dofe/sso-contracts/token')) {
    failures.push(`${file}: must consume token/OIDC constants from @dofe/sso-contracts/token`);
  }
  if (content.includes('@repo/constants')) {
    failures.push(`${file}: must not keep token/OIDC constants from @repo/constants after @dofe/sso-contracts@0.1.70`);
  }
}

for (const packageDir of ['apps/api', 'apps/web']) {
  try {
    require.resolve('@dofe/sso-contracts/token', { paths: [path.join(root, packageDir)] });
  } catch (error) {
    failures.push(`@dofe/sso-contracts/token must resolve from ${packageDir}`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: SSO token/OIDC constants must stay on @dofe/sso-contracts/token');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('PASS: token/OIDC constants consume @dofe/sso-contracts/token');
NODE
then
  :
else
  failures=$((failures + 1))
fi

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
