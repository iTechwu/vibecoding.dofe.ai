#!/usr/bin/env bash
# =============================================================================
# build-sandbox.sh — 构建 dofe-ai/sandbox:latest (Loops Remote Runner)
# =============================================================================
# 前置条件: dofe-ai/sandbox:base 必须已构建或可用
#
# 用法:
#   cd /path/to/vibecoding.dofe.ai
#   bash apps/api/docker/build-sandbox.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

BASE_IMAGE="dofe-ai/sandbox:base"
IMAGE="dofe-ai/sandbox:latest"
DOCKERFILE="$SCRIPT_DIR/sandbox.Dockerfile"

echo "=============================================="
echo "  Building $IMAGE"
echo "=============================================="
echo "  Dockerfile:  $DOCKERFILE"
echo "  Context:     $REPO_ROOT"
echo "  Base image:  $BASE_IMAGE"
echo "=============================================="

# 检查基础镜像是否存在
if ! docker image inspect "$BASE_IMAGE" >/dev/null 2>&1; then
  echo "⚠️  $BASE_IMAGE not found — building it first..."
  bash "$SCRIPT_DIR/build-sandbox-base.sh"
fi

docker build \
  -f "$DOCKERFILE" \
  -t "$IMAGE" \
  "$REPO_ROOT"

echo ""
echo "✅ $IMAGE built successfully"
echo ""
echo "Verify:"
echo "  docker run --rm $IMAGE codex --version"
echo "  docker run --rm $IMAGE claude --version"
echo ""
echo "E2E smoke test:"
echo "  docker run --rm --network=none --read-only --tmpfs /tmp $IMAGE codex exec 'Reply OK'"