import { Module } from '@nestjs/common';
import { AgentRuntimeDetectionService } from './agent-runtime-detection.service';
import { LoopsDockerClient } from './loops-docker.client';
import { LoopsDockerSandboxService } from './loops-docker-sandbox.service';
import { LoopsWorkspaceProfileService } from './loops-workspace-profile.service';

/**
 * Loops Runtime domain module — `@app/services/loops-runtime`.
 *
 * 结构优化 Step 4：runtime 检测 / workspace profile / Docker 控制点下沉。
 *
 * 当前承接（本批，整文件搬迁）：
 * - `AgentRuntimeDetectionService`：local CLI + Docker runtime 检测。
 * - `LoopsDockerClient`：Docker Engine 控制点（pull / diagnostics）。
 * - `LoopsDockerSandboxService`：Docker sandbox command profile + execution。
 * - `LoopsWorkspaceProfileService`：workspace runtime profile（file-backed）。
 * - `loops-runtime-images.ts`：Docker fallback 镜像 / 本地 CLI 命令 / config 目录常量。
 *
 * `loops-runtime-command-builder.util` 归属 `loops-runners`。
 */
@Module({
  providers: [
    AgentRuntimeDetectionService,
    LoopsDockerClient,
    LoopsDockerSandboxService,
    LoopsWorkspaceProfileService,
  ],
  exports: [
    AgentRuntimeDetectionService,
    LoopsDockerClient,
    LoopsDockerSandboxService,
    LoopsWorkspaceProfileService,
  ],
})
export class LoopsRuntimeModule {}
