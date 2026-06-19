import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// tsconfig.json is JSONC (contains comments), parse manually.
// NOTE: jest 30 evaluates a `.ts` config in an ES-module scope where `__dirname`
// is undefined; `process.cwd()` is a Node global available in both CJS and ESM,
// and jest is always launched from the `apps/api` package directory.
const tsconfigRaw = readFileSync(resolve(process.cwd(), 'tsconfig.json'), 'utf-8');
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
  // Allow transforming monorepo packages that ship as uncompiled TS source
  transformIgnorePatterns: ['node_modules/(?!(uuid|@dofe|@repo)/)'],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(filteredPaths, {
    prefix: '<rootDir>/',
  }),
};

export default config;
