import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { LoopsDbModule } from '@app/db';
import { LoopEvalAggregationModule } from '@app/db/loop-eval-aggregation';
import { AuditLogModule } from '@app/audit-log';
// 结构优化 Step 0：接入 loops domain 装配入口。后续子域 provider 下沉后，
// API 层只通过此 module 消费 domain 能力（依赖方向 src -> domain -> infra）。
import { LoopsDomainModule } from '@app/services/loops';
import { CliLoopsAgentAdapter } from './adapters/cli-loops-agent.adapter';
import { CliLoopsClaudeAdapter } from './adapters/cli-loops-claude.adapter';
import { CliLoopsGitAdapter } from './adapters/cli-loops-git.adapter';
import { DeterministicLoopsClaudeAdapter } from './adapters/deterministic-loops-claude.adapter';
import { DeterministicLoopsAgentAdapter } from './adapters/deterministic-loops-agent.adapter';
import { LOOPS_AGENT_ADAPTER } from './adapters/loops-agent-adapter.interface';
import { LOOPS_CLAUDE_ADAPTER } from './adapters/loops-claude-adapter.interface';
import { LOOPS_GIT_ADAPTER } from './adapters/loops-git-adapter.interface';
import { LoopsPrProviderClient } from './adapters/loops-pr-provider.client';
import { AgentRuntimeDetectionService } from './agent-runtime-detection.service';
import { LoopsController } from './loops.controller';
import { LoopsCapabilityRegistry } from './loops-capability-registry';
import { LoopsRunnerService } from './loops-runner.service';
import { LoopsService } from './loops.service';
import { LoopsBrowserQaWorkerService } from './loops-browser-qa-worker.service';
import { LoopsSecondOpinionWorkerService } from './loops-second-opinion-worker.service';
import { LoopsDockerSandboxService } from './loops-docker-sandbox.service';
import { LoopsLearningGovernanceService } from './loops-learning-governance.service';
import { LoopsEvalAggregationWorkerService } from './loops-eval-aggregation-worker.service';
import { LoopsEvalAggregationProcessor } from './loops-eval-aggregation.processor';
import { LoopsRemoteRunnerProcessor } from './loops-remote-runner.processor';
import { LoopsTriggerSchedulerProcessor } from './loops-trigger-scheduler.processor';
import { LoopsCrossTenantArchiveService } from './loops-cross-tenant-archive.service';
import { LoopsMcpClientService } from './loops-mcp-client.service';
import { LoopsMcpSecretService } from './loops-mcp-secret.service';

@Module({
  // HttpModule provides HttpService to LoopsPrProviderClient (and the
  // LOOPS_GIT_ADAPTER factory) so external HTTP goes through @nestjs/axios
  // (Rule 3) instead of global `fetch` on the production path.
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
    LoopsCapabilityRegistry,
    // 0622 · B2: host runtime detection (local CLI + Docker). workspace profile
    // + Docker client 已下沉到 `LoopsRuntimeModule`（经 LoopsDomainModule re-export）。
    AgentRuntimeDetectionService,
    // 结构优化 Step 1c：file-store / persistence / LOOPS_PERSISTENCE /
    // notification-sender 已下沉到 `LoopsStoreModule`（经 LoopsDomainModule re-export）。
    LoopsRunnerService,
    LoopsBrowserQaWorkerService,
    LoopsSecondOpinionWorkerService,
    LoopsDockerSandboxService,
    LoopsLearningGovernanceService,
    LoopsEvalAggregationWorkerService,
    LoopsEvalAggregationProcessor,
    LoopsRemoteRunnerProcessor,
    LoopsTriggerSchedulerProcessor,
    LoopsCrossTenantArchiveService,
    LoopsMcpClientService,
    LoopsMcpSecretService,
    // 结构优化 Step 1b：工作锁 service + LOOPS_LOCK_BACKEND backend 绑定已下沉到
    // `LoopsLocksModule`（经 `LoopsDomainModule` re-export 注入）。
    DeterministicLoopsAgentAdapter,
    DeterministicLoopsClaudeAdapter,
    CliLoopsAgentAdapter,
    CliLoopsClaudeAdapter,
    LoopsPrProviderClient,
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
