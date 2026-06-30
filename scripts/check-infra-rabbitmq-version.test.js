const test = require('node:test');
const assert = require('node:assert/strict');
const { checkInfraRabbitmqVersion } = require('./check-infra-rabbitmq-version');

const apiPackage = (version) => ({
  dependencies: {
    '@dofe/infra-rabbitmq': version,
  },
});

test('passes when override and importer pin match apps/api package version', () => {
  const result = checkInfraRabbitmqVersion({
    apiPackage: apiPackage('0.1.80'),
    lockfile: `
overrides:
  '@dofe/infra-rabbitmq': 0.1.80

importers:
  apps/api:
    dependencies:
      '@dofe/infra-rabbitmq':
        specifier: 0.1.80
        version: 0.1.80(abc)
`,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('reports stale lockfile override and importer pin', () => {
  const result = checkInfraRabbitmqVersion({
    apiPackage: apiPackage('0.1.80'),
    lockfile: `
overrides:
  '@dofe/infra-rabbitmq': 0.1.78

importers:
  apps/api:
    dependencies:
      '@dofe/infra-rabbitmq':
        specifier: 0.1.78
        version: 0.1.78(abc)
`,
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues, [
    'pnpm-lock.yaml override pins @dofe/infra-rabbitmq to 0.1.78, but apps/api/package.json expects 0.1.80.',
    'pnpm-lock.yaml does not pin the apps/api importer @dofe/infra-rabbitmq version to 0.1.80.',
  ]);
});
