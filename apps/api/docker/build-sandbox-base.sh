#!/usr/bin/env bash
# =============================================================================
# build-sandbox-base.sh — 构建 dofe-ai/sandbox:base 共享基础镜像
# =============================================================================
# 此镜像被 Loops (:latest) 和 Bot Sandbox (:full) 两个下游镜像 FROM。
# 构建时需要在 monorepo 根目录执行，因为 COPY 路径相对于 context。
#
# 用法:
#   cd /path/to/vibecoding.dofe.ai
#   bash apps/api/docker/build-sandbox-base.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

IMAGE="dofe-ai/sandbox:base"
DOCKERFILE="$SCRIPT_DIR/sandbox-base.Dockerfile"
NODE_VERSION="${NODE_VERSION:-22}"
PNPM_VERSION="${PNPM_VERSION:-10.33.4}"

echo "=============================================="
echo "  Building $IMAGE"
echo "=============================================="
echo "  Dockerfile:  $DOCKERFILE"
echo "  Context:     $REPO_ROOT"
echo "  Node.js:     $NODE_VERSION"
echo "  pnpm:        $PNPM_VERSION"
echo "=============================================="

docker build \
  --build-arg NODE_VERSION="$NODE_VERSION" \
  --build-arg PNPM_VERSION="$PNPM_VERSION" \
  -f "$DOCKERFILE" \
  -t "$IMAGE" \
  "$REPO_ROOT"

echo ""
echo "✅ $IMAGE built successfully"
echo ""
echo "Verify:"
echo "  docker run --rm $IMAGE node --version"
echo "  docker run --rm $IMAGE pnpm --version"
echo "  docker run --rm $IMAGE git --version"