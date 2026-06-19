import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// tsconfig.json is JSONC (contains comments), parse manually
const tsconfigRaw = readFileSync(resolve(__dirname, 'tsconfig.json'), 'utf-8');
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
