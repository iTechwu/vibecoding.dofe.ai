# =============================================================================
# dofe-ai/sandbox:base — 共享基础 toolchain 镜像
# =============================================================================
# 使用方:
#   - vibecoding.dofe.ai: Loops Remote Runner (FROM sandbox:base → sandbox:latest)
#   - agents.dofe.ai:     Bot Gateway Sandbox  (FROM sandbox:base → sandbox:full)
#
# 内容:
#   - Node.js 22 + pnpm 10
#   - Git 2.x + openssh-client
#   - Python 3.12 + pip
#   - build-essential (gcc, make)
#   - curl, jq, ca-certificates
#   - /workspace 挂载点
#   - 非 root 用户 dofe (UID 1001)
#
# 构建:
#   docker build -f apps/api/docker/sandbox-base.Dockerfile -t dofe-ai/sandbox:base .
# =============================================================================

ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-slim

LABEL org.dofe.image.role="sandbox-base"
LABEL org.dofe.image.targets="loops-remote-runner,bot-gateway-sandbox"

# ---------------------------------------------------------------------------
# 系统依赖
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    curl \
    jq \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

# 创建 python 别名
RUN ln -sf /usr/bin/python3 /usr/local/bin/python

# ---------------------------------------------------------------------------
# pnpm（与两个项目的 monorepo pnpm 版本一致）
# ---------------------------------------------------------------------------
ARG PNPM_VERSION=10.33.4
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# ---------------------------------------------------------------------------
# 工作空间
# ---------------------------------------------------------------------------
RUN mkdir -p /workspace /tmp/sandbox-tmp && chmod 1777 /tmp/sandbox-tmp

# ---------------------------------------------------------------------------
# 非 root 用户
# ---------------------------------------------------------------------------
RUN groupadd --gid 1001 dofe && \
    useradd --uid 1001 --gid dofe --create-home --shell /bin/bash dofe && \
    chown -R dofe:dofe /workspace

# ---------------------------------------------------------------------------
# 环境变量
# ---------------------------------------------------------------------------
ENV LANG=C.UTF-8
ENV PNPM_HOME=/home/dofe/.local/share/pnpm
ENV PATH=/home/dofe/.local/share/pnpm:/usr/local/bin:$PATH
ENV WORKSPACE=/workspace

WORKDIR /workspace
