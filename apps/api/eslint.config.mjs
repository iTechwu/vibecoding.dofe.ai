import nestJsConfig from '@dofe/infra-config/eslint/nest-js';
import importPlugin from 'eslint-plugin-import';

export default [
  ...nestJsConfig,
  {
    // The published nest-js config sets `parserOptions.project: './tsconfig.json'`,
    // resolved relative to the ESLint cwd. lint-staged runs ESLint from the repo
    // root, which has no tsconfig.json, so resolve the project per source file
    // instead (finds apps/api/tsconfig.json regardless of cwd).
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
  },
  {
    plugins: {
      import: importPlugin,
    },
  },
  {
    ignores: ['dist/**', 'generated/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.ts', 'libs/**/*.ts'],
    rules: {
      'import/no-restricted-paths': [
        'warn',
        {
          zones: [
            {
              target: './src/plugins/**/*',
              from: './src/modules/**/*',
              message:
                '[架构违规] Plugin 禁止直接访问 API Service。请通过 Plugin Client Facade 访问平台能力。',
            },
            {
              target: './src/plugins/**/*',
              from: './generated/db/**/*',
              message: '[架构违规] Plugin 禁止直接访问 DB 层。',
            },
          ],
        },
      ],
      'import/no-unresolved': 'off',
    },
  },
];
