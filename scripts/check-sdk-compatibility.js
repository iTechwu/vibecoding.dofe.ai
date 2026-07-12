const fs = require('fs');
const path = require('path');

const checks = [
  {
    packageName: '@dofe/infra-docker',
    packageDir: 'apps/api',
    exports: [
      'createDockerClient',
      'inspectDockerImage',
      'probeDockerDaemon',
      'pullDockerImage',
      'redactDockerAuth',
      'registryAuthFromEnv',
      'safeDockerMessage',
    ],
  },
  {
    packageName: '@dofe/sso-nestjs',
    packageDir: 'apps/api',
    exports: ['DOFE_RF_COOKIE', 'classifyRefreshError', 'SsoClientModule'],
  },
  {
    packageName: '@dofe/sso-browser',
    packageDir: 'apps/web',
    exports: ['checkSsoSession', 'checkSsoSessionViaIframe'],
  },
];

const failures = [];

for (const check of checks) {
  try {
    const entryPath = require.resolve(check.packageName, {
      paths: [path.join(process.cwd(), check.packageDir)],
    });
    const packageJsonPath = findPackageJson(entryPath);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (!/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
      failures.push(`${check.packageName} must resolve to an exact release, found ${packageJson.version}`);
      continue;
    }
    const declarations = readDeclarationFiles(path.join(path.dirname(packageJsonPath), 'dist'));
    for (const exportedName of check.exports) {
      if (!new RegExp(`\\b${exportedName}\\b`).test(declarations)) {
        failures.push(`${check.packageName} no longer declares ${exportedName}`);
      }
    }
  } catch (error) {
    failures.push(`${check.packageName} compatibility check failed: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error('SDK compatibility check failed.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('SDK compatibility check passed.');

function findPackageJson(entryPath) {
  let directory = path.dirname(entryPath);
  while (directory !== path.dirname(directory)) {
    const candidate = path.join(directory, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    directory = path.dirname(directory);
  }
  throw new Error(`package.json not found above ${entryPath}`);
}

function readDeclarationFiles(distDirectory) {
  return fs
    .readdirSync(distDirectory, { recursive: true })
    .filter((entry) => entry.endsWith('.d.ts'))
    .map((entry) => fs.readFileSync(path.join(distDirectory, entry), 'utf8'))
    .join('\n');
}
