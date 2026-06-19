import { config as baseConfig } from './base.js';

/**
 * Shared ESLint configuration for NestJS backend apps.
 *
 * Extends the base config with:
 * - TypeScript-aware import resolution
 * - Architecture dependency constraints (plugin → module isolation)
 * - Prisma access rules (DB access only through @app/db)
 * - Import ordering enforcement
 */
export const config = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-prototype-builtins': 'warn',
      'no-case-declarations': 'warn',
      'prefer-const': 'warn',
      'no-useless-catch': 'warn',
      'no-empty': 'warn',
    },
  },
  {
    files: ['src/modules/**/*.ts', 'libs/domain/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            'MemberExpression[object.object.type="ThisExpression"][object.property.name="prisma"][property.name=/^(write|read)$/]',
          message:
            '[架构违规] 禁止直接使用 this.prisma.write 或 this.prisma.read。\n' +
            '请通过 DB Service (@app/db) 访问数据库。',
        },
        {
          selector:
            'MemberExpression[object.property.name="prisma"][property.name=/^(write|read)$/]:not([object.object.type="ThisExpression"])',
          message:
            '[架构违规] 禁止直接使用 prisma.write 或 prisma.read。\n' +
            '请通过 DB Service (@app/db) 访问数据库。',
        },
      ],
    },
  },
];
