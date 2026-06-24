#!/usr/bin/env bash
# =============================================================================
# sandbox-entrypoint.sh — Loops Remote Runner sandbox entrypoint
# =============================================================================
# 由 dofe-ai/sandbox:latest 调用，负责:
#   1. 校验容器安全配置（network, read-only, capabilities）
#   2. 切换到 /workspace
#   3. 执行传入命令
#
# 用法:
#   docker run --rm --network=none --read-only --tmpfs /tmp \
#     -v /host/repo:/workspace \
#     dofe-ai/sandbox:latest codex exec "add types to index.ts"
# =============================================================================
set -euo pipefail

echo "[dofe-sandbox] $(date -Iseconds) container started"

# 安全自检
if ip link show lo >/dev/null 2>&1 && ip route show default 2>/dev/null | grep -q .; then
  echo "[dofe-sandbox] WARNING: network routing detected — sandbox may have network access"
fi

if touch /test-write 2>/dev/null; then
  echo "[dofe-sandbox] WARNING: rootfs is writable — consider --read-only"
  rm -f /test-write
else
  echo "[dofe-sandbox] rootfs read-only ✓"
fi

# 执行传入命令
if [ $# -gt 0 ]; then
  echo "[dofe-sandbox] executing: $*"
  exec "$@"
else
  echo "[dofe-sandbox] entering interactive shell"
  exec /bin/bash
fi
