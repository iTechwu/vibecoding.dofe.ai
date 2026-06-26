import { Module } from '@nestjs/common';
import { LoopsDockerClient } from './loops-docker.client';
import { LoopsWorkspaceProfileService } from './loops-workspace-profile.service';

/**
 * Loops Runtime domain module — `@app/services/loops-runtime`.
 *
 * 结构优化 Step 4：runtime 检测 / workspace profile / Docker 控制点下沉。
 *
 * 当前承接（本批，整文件搬迁）：
 * - `LoopsDockerClient`：Docker Engine 控制点（pull / diagnostics）。
 * - `LoopsWorkspaceProfileService`：workspace runtime profile（file-backed）。
 * - `loops-runtime-images.ts`：Docker fallback 镜像 / 本地 CLI 命令 / config 目录常量。
 *
 * 仅注入 optional WINSTON logger，无额外 module 依赖。export 两个 service 供
 * `LoopsService`（workspaceProfile）与 `AgentRuntimeDetectionService`（docker）注入。
 *
 * 待后续 Step：
 * - `AgentRuntimeDetectionService`：依赖 `adapters/loops-process.util`，随 loops-runners
 *   一起迁（Step 4 后续批次）。
 * - `loops-runtime-command-builder.util`：归属 `loops-runners`。
 */
@Module({
  providers: [LoopsDockerClient, LoopsWorkspaceProfileService],
  exports: [LoopsDockerClient, LoopsWorkspaceProfileService],
})
export class LoopsRuntimeModule {}
