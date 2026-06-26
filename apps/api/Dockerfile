# ============================================================================
# DofeAI - NestJS Backend Dockerfile (Optimized)
# Multi-stage build with production-only dependencies
# ============================================================================

# ---- Stage 1: Base Dependencies ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
RUN apk add --no-cache openssl
WORKDIR /app

# ---- Stage 2: All Dependencies (for build) ----
FROM base AS deps

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY .nvmrc ./

# Copy package.json files for all workspace packages
COPY packages/constants/package.json packages/constants/
COPY packages/validators/package.json packages/validators/
COPY packages/utils/package.json packages/utils/
COPY packages/contracts/package.json packages/contracts/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# ---- Stage 3: Builder ----
FROM base AS builder

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .nvmrc ./
COPY scripts/ ./scripts/

# Build API (builds packages first due to dependency order)
RUN pnpm build:api

# ---- Stage 4: Production Dependencies ----
FROM base AS prod-deps

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package.json files
COPY packages/constants/package.json packages/constants/
COPY packages/validators/package.json packages/validators/
COPY packages/utils/package.json packages/utils/
COPY packages/contracts/package.json packages/contracts/
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# ---- Stage 5: Runner (Production) ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy production dependencies
COPY --from=prod-deps --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=appuser:nodejs /app/packages ./packages

# Copy built output
COPY --from=builder --chown=appuser:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/apps/api/prisma ./prisma
COPY --from=builder --chown=appuser:nodejs /app/apps/api/generated ./generated

# Copy package.json for runtime
COPY --from=builder --chown=appuser:nodejs /app/apps/api/package.json ./

# Copy prisma CLI from builder stage (devDependency, needed for migrate deploy)
COPY --from=builder --chown=appuser:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=appuser:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:13100/health || exit 1

EXPOSE 13100

# Run migrations then start the server
CMD ["sh", "-c", "node_modules/prisma/build/index.js migrate deploy && node dist/main"]
