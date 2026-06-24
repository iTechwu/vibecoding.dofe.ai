# =============================================================================
# dofe-ai/sandbox:latest — Loops Remote Runner sandbox
# =============================================================================
# 用途: Loops Remote Runner 的短期、安全沙箱执行环境。
# 安全配置由 LoopsDockerSandboxService 在运行时通过 docker run 参数应用:
#   --network=none --read-only --cap-drop=ALL --security-opt=no-new-privileges
#
# 内容 (叠加在 sandbox:base 之上):
#   - Codex CLI (OpenAI headless coding agent)
#   - Claude Code CLI (Anthropic headless coding agent)
#   - dofe 非 root 用户
#
# 构建:
#   docker build -f apps/api/docker/sandbox.Dockerfile -t dofe-ai/sandbox:latest .
#
# 验证:
#   docker run --rm dofe-ai/sandbox:latest codex --version
#   docker run --rm --network=none --read-only --tmpfs /tmp \
#     dofe-ai/sandbox:latest claude --version
# =============================================================================

FROM dofe-ai/sandbox:base

LABEL org.dofe.image.role="loops-sandbox"
LABEL org.dofe.image.security="network=none,read-only,cap-drop=ALL,no-new-privileges"

# ---------------------------------------------------------------------------
# Codex CLI
# 安装方式: 通过 npm（稳定方式，版本可锁定）
# 备选: curl -fsSL https://codex.openai.com/install.sh | bash
# ---------------------------------------------------------------------------
ARG CODEX_VERSION=latest
RUN npm install -g @openai/codex-cli@${CODEX_VERSION} 2>/dev/null || \
    curl -fsSL https://codex.openai.com/install.sh | bash

# ---------------------------------------------------------------------------
# Claude Code CLI
# 通过 npm 安装 @anthropic-ai/claude-code
# ---------------------------------------------------------------------------
ARG CLAUDE_CODE_VERSION=latest
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# ---------------------------------------------------------------------------
# 切换到非 root 用户
# ---------------------------------------------------------------------------
USER dofe

# ---------------------------------------------------------------------------
# 验证安装
# ---------------------------------------------------------------------------
RUN codex --version && claude --version

# ---------------------------------------------------------------------------
# 入口（可选覆盖）
# ---------------------------------------------------------------------------
COPY docker/sandbox-entrypoint.sh /usr/local/bin/dofe-sandbox-entrypoint.sh
RUN chmod +x /usr/local/bin/dofe-sandbox-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/dofe-sandbox-entrypoint.sh"]
CMD ["/bin/bash"]
