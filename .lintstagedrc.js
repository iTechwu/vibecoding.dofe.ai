module.exports = {
  '*.{ts,tsx}': ['pnpm exec eslint --fix', 'pnpm exec prettier --write'],
  '*.{json,md,yaml,yml}': ['pnpm exec prettier --write'],
  '*.prisma': ['prisma format --schema=./apps/api/prisma/schema.prisma'],
};
