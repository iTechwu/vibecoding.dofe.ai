import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { LoopsDbModule } from '@app/db';
import { LoopEvalAggregationModule } from '@app/db/loop-eval-aggregation';
import { AuditLogModule } from '@app/audit-log';
// 结构优化 Step 0：接入 loops domain 装配入口。后续子域 provider 下沉后，
// API 层只通过此 module 消费 domain 能力（依赖方向 src -> domain -> infra）。
import { LoopsDomainModule } from '@app/services/loops';
import {
  CliLoopsAgentAdapter,
  CliLoopsClaudeAdapter,
  CliLoopsGitAdapter,
  DeterministicLoopsAgentAdapter,
  DeterministicLoopsClaudeAdapter,
  LoopsRunnerService,
  LOOPS_AGENT_ADAPTER,
  LOOPS_CLAUDE_ADAPTER,
  LOOPS_GIT_ADAPTER,
  type LoopsAgentAdapter,
  type LoopsClaudeAdapter,
  type LoopsGitAdapter,
} from '@app/services/loops-runners';
import { LoopsController } from './loops.controller';
import { LoopsService } from './loops.service';
import { LoopsEvalAggregationProcessor } from './loops-eval-aggregation.processor';
import { LoopsRemoteRunnerProcessor } from './loops-remote-runner.processor';
import { LoopsTriggerSchedulerProcessor } from './loops-trigger-scheduler.processor';
import { LoopsCrossTenantArchiveService } from './loops-cross-tenant-archive.service';
import {
  createRemoteShardExecutionPort,
  createRemoteShardRuntimeAdapter,
  LoopsRemoteShardRuntimeAdapter,
} from './loops-remote-shard-runtime.adapter';
import {
  createRemoteShardStateAdapter,
  LoopsRemoteShardStateAdapter,
} from './loops-remote-shard-state.adapter';
import { LoopsRemoteShardDetailAdapter } from './loops-remote-shard-detail.adapter';
import { LoopsRemoteRunnersLogAdapter } from './loops-remote-runners-log.adapter';
import { LoopsPrProviderClient } from '@app/services/loops-integrations';
import {
  LOOPS_ARCHIVE_COLLECTION_PORT,
  LoopsArchiveCollectionService,
} from '@app/services/loops-admin';
import { LOOPS_ISSUE_CREATION_PORT } from '@app/services/loops-triggers';
import { LoopsIssuesService } from '@app/services/loops-issues';
import {
  LOOPS_REMOTE_SHARD_EXECUTION_PORT,
  LoopsRemoteRunnersService,
} from '@app/services/loops-remote-runners';
import { LOOPS_EVAL_EVIDENCE_PORT } from '@app/services/loops-eval';
import { LoopsDockerSandboxService } from '@app/services/loops-runtime';
import { LoopsFileStoreService } from '@app/services/loops-store';
import { LoopsEngineService } from '@app/services/loops-engine';

@Module({
  // HttpModule is kept for API-layer adapters; integration HTTP providers now
  // live in LoopsIntegrationsModule, which imports its own HttpModule. It also
  // provides HttpService to LoopsPrProviderClient through the domain module so
  // external HTTP goes through @nestjs/axios (Rule 3) instead of global `fetch`.
  // (LoopsNotificationSender now lives in LoopsStoreModule, which imports its
  // own HttpModule — Step 1c.)
  imports: [
    HttpModule,
    LoopsDbModule,
    LoopEvalAggregationModule,
    AuditLogModule,
    // R33+: BullMQ queue for periodic cross-tenant Eval aggregation.
    BullModule.registerQueue({ name: 'loops-eval-aggregation' }),
    // R34a: BullMQ queue for Remote Runner distributed job execution.
    BullModule.registerQueue({ name: 'loops-remote-runner' }),
    // R34b: BullMQ queue for trigger auto-execution scheduler.
    BullModule.registerQueue({ name: 'loops-trigger-scheduler' }),
    // 结构优化 Step 0/1：domain 装配入口，re-export 已下沉的子域 module
    // （loops-store / loops-locks / …），API 层 provider 经此注入 domain service。
    LoopsDomainModule,
  ],
  controllers: [LoopsController],
  providers: [
    LoopsService,
    // 0622 · B2: host runtime detection / workspace profile / Docker client
    // 已下沉到 `LoopsRuntimeModule`（经 LoopsDomainModule re-export）。
    // 结构优化 Step 1c：file-store / persistence / LOOPS_PERSISTENCE /
    // notification-sender 已下沉到 `LoopsStoreModule`（经 LoopsDomainModule re-export）。
    LoopsEvalAggregationProcessor,
    LoopsRemoteRunnerProcessor,
    LoopsTriggerSchedulerProcessor,
    {
      provide: LOOPS_ARCHIVE_COLLECTION_PORT,
      useExisting: LoopsArchiveCollectionService,
    },
    // 结构优化 nextstep Step N3：trigger fire 的 issue creation port 实现已从
    // legacy facade 下沉到 `LoopsIssuesService.createIssue`（完整 intake 编排）。
    // `LoopsTriggerSchedulerProcessor` 与 facade 均经此 token 注入 domain service。
    {
      provide: LOOPS_ISSUE_CREATION_PORT,
      useExisting: LoopsIssuesService,
    },
    // 结构优化 nextstep Step N7：remote shard execution 编排已迁入
    // `LoopsRemoteRunnersService`；runtime/state/detail/log adapters 由 API layer
    // 显式装配，不再经 legacy facade 桥接。
    {
      provide: LOOPS_REMOTE_SHARD_EXECUTION_PORT,
      useFactory: createRemoteShardExecutionPort,
      inject: [LoopsRemoteRunnersService, LoopsRemoteShardRuntimeAdapter],
    },
    // 结构优化 nextstep Step N2 收尾：eval evidence port 经 facade 的
    // `evalEvidencePort` 适配（list/readDetail/cost enrichment 仍在 facade），
    // 供 domain `LoopsEvalAggregationRunnerService` 注入。
    {
      provide: LOOPS_EVAL_EVIDENCE_PORT,
      useFactory: (service: LoopsService) => service.evalEvidencePort,
      inject: [LoopsService],
    },
    LoopsCrossTenantArchiveService,
    {
      provide: LoopsRemoteShardRuntimeAdapter,
      useFactory: (
        detailAdapter: LoopsRemoteShardDetailAdapter,
        logAdapter: LoopsRemoteRunnersLogAdapter,
        runner: LoopsRunnerService,
        claudeAdapter: LoopsClaudeAdapter,
        agentAdapter: LoopsAgentAdapter,
        stateAdapter: LoopsRemoteShardStateAdapter,
        dockerSandbox: LoopsDockerSandboxService,
      ) =>
        createRemoteShardRuntimeAdapter({
          detailAdapter,
          logAdapter,
          runner,
          claudeAdapter,
          agentAdapter,
          stateAdapter,
          dockerSandbox,
        }),
      inject: [
        LoopsRemoteShardDetailAdapter,
        LoopsRemoteRunnersLogAdapter,
        LoopsRunnerService,
        LOOPS_CLAUDE_ADAPTER,
        LOOPS_AGENT_ADAPTER,
        LoopsRemoteShardStateAdapter,
        LoopsDockerSandboxService,
      ],
    },
    {
      provide: LoopsRemoteShardStateAdapter,
      useFactory: (
        detailAdapter: LoopsRemoteShardDetailAdapter,
        store: LoopsFileStoreService,
        engine: LoopsEngineService,
        gitAdapter: LoopsGitAdapter,
      ) =>
        createRemoteShardStateAdapter({
          detailAdapter,
          store,
          engine,
          gitAdapter,
        }),
      inject: [
        LoopsRemoteShardDetailAdapter,
        LoopsFileStoreService,
        LoopsEngineService,
        LOOPS_GIT_ADAPTER,
      ],
    },
    LoopsRemoteShardDetailAdapter,
    LoopsRemoteRunnersLogAdapter,
    // 结构优化 Step 1b：工作锁 service + LOOPS_LOCK_BACKEND backend 绑定已下沉到
    // `LoopsLocksModule`（经 `LoopsDomainModule` re-export 注入）。
    DeterministicLoopsAgentAdapter,
    DeterministicLoopsClaudeAdapter,
    CliLoopsAgentAdapter,
    CliLoopsClaudeAdapter,
    {
      provide: LOOPS_AGENT_ADAPTER,
      useExisting:
        process.env.LOOPS_AGENT_MODE === 'cli'
          ? CliLoopsAgentAdapter
          : DeterministicLoopsAgentAdapter,
    },
    {
      provide: LOOPS_CLAUDE_ADAPTER,
      useExisting:
        process.env.LOOPS_AGENT_MODE === 'cli'
          ? CliLoopsClaudeAdapter
          : DeterministicLoopsClaudeAdapter,
    },
    {
      provide: LOOPS_GIT_ADAPTER,
      useFactory: (prProvider: LoopsPrProviderClient) =>
        new CliLoopsGitAdapter(
          {
            commitPerShard: process.env.LOOPS_GIT_COMMIT_PER_SHARD === 'true',
            baseBranch: process.env.LOOPS_GIT_BASE_BRANCH ?? 'main',
          },
          prProvider,
        ),
      inject: [LoopsPrProviderClient],
    },
  ],
})
export class LoopsModule {}
