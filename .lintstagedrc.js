module.exports = {
  '*.{ts,tsx}': ['pnpm exec eslint --fix', 'pnpm exec prettier --write'],
  '*.{json,md,yaml,yml}': ['pnpm exec prettier --write'],
  // Prisma is a dependency of @repo/api, so the binary lives under
  // apps/api/node_modules/.bin — it is NOT on the repo-root PATH. Use the
  // explicit path so lint-staged (which runs from the repo root) can spawn it.
  '*.prisma': [
    'apps/api/node_modules/.bin/prisma format --schema=./apps/api/prisma/schema.prisma',
  ],
};
