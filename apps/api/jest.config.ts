import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// tsconfig.json is JSONC (contains comments), parse manually.
// NOTE: jest 30 evaluates a `.ts` config in an ES-module scope where `__dirname`
// is undefined. Resolve from this config file instead of `process.cwd()` so the
// config works when invoked from the repo root or the `apps/api` package dir.
const configDir = dirname(fileURLToPath(import.meta.url));
const tsconfigRaw = readFileSync(resolve(configDir, 'tsconfig.json'), 'utf-8');
const tsconfig = JSON.parse(tsconfigRaw.replace(/^\s*\/\/.*$/gm, ''));
const { paths, ...restCompilerOptions } = tsconfig.compilerOptions;
// Exclude the wildcard "*" path which breaks module resolution
const { '*': _, ...filteredPaths } = paths;

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { diagnostics: false }],
  },
  // Allow transforming monorepo/infra packages that ship as uncompiled TS source
  // (or as ESM, e.g. uuid@14). The naive `node_modules/(?!(uuid|@dofe|@repo)/)`
  // pattern does NOT work under pnpm: real paths live under
  // `node_modules/.pnpm/<pkg>@x/node_modules/<pkg>/...`, so the lookahead is
  // evaluated against `.pnpm` (first segment) and the package is wrongly ignored
  // (its ESM then fails to parse). Match the pnpm virtual-store layout directly:
  // transform `.pnpm/` entries whose store dir starts with uuid/@dofe/@repo
  // (e.g. `uuid@14.0.0`, `@dofe+infra-utils@...`); keep a flat-layout fallback.
  transformIgnorePatterns: [
    'node_modules/\\.pnpm/(?!(uuid|@dofe|@repo)[+@])',
    'node_modules/(?!\\.pnpm/)(?!(uuid|@dofe|@repo)/)',
  ],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(filteredPaths, {
    prefix: '<rootDir>/',
  }),
};

export default config;
