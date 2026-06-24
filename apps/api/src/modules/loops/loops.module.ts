import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { LoopsDbModule } from '@app/db';
import { LoopEvalAggregationModule } from '@app/db/loop-eval-aggregation';
import { AuditLogModule } from '@app/audit-log';
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
import { LoopsDockerClient } from './loops-docker.client';
import { LoopsController } from './loops.controller';
import { LoopsCapabilityRegistry } from './loops-capability-registry';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsWorkspaceProfileService } from './loops-workspace-profile.service';
import { InMemoryLoopsLockBackend } from './in-memory-loops-lock.backend';
import { LOOPS_LOCK_BACKEND } from './loops-lock-backend.interface';
import { LoopsNotificationSender } from './loops-notification-sender.service';
import { LoopsPersistenceService } from './loops-persistence.service';
import { LOOPS_PERSISTENCE } from './loops-persistence.token';
import { LoopsRunnerService } from './loops-runner.service';
import { LoopsService } from './loops.service';
import { LoopsWorkLockService } from './loops-work-lock.service';
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

@Module({
  // HttpModule provides HttpService to LoopsNotificationSender and
  // LoopsPrProviderClient so external HTTP goes through @nestjs/axios (Rule 3)
  // instead of global `fetch` on the production path.
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
  ],
  controllers: [LoopsController],
  providers: [
    LoopsService,
    LoopsCapabilityRegistry,
    LoopsNotificationSender,
    LoopsFileStoreService,
    // 0622 · B1/B2: workspace runtime profile (file-backed) + host runtime
    // detection (local CLI + Docker). Consumed by LoopsService via optional DI.
    LoopsWorkspaceProfileService,
    AgentRuntimeDetectionService,
    // Single Docker control point. It adapts @dofe/infra-docker Engine helpers
    // to Loops-specific diagnostics and pull responses.
    LoopsDockerClient,
    LoopsPersistenceService,
    // Alias the concrete persistence service to the injection token used by
    // `LoopsService`, so the DB-backed implementation is only pulled into the
    // NestJS graph and never into standalone `ts-node` consumers.
    { provide: LOOPS_PERSISTENCE, useExisting: LoopsPersistenceService },
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
    LoopsDockerSandboxService,
    LoopsWorkLockService,
    // Work-lock backend: in-memory by default (single-process, unchanged
    // behaviour). Swap to RedisLoopsLockBackend (bound to @dofe/infra-redis
    // via a factory) when multi-instance locking is enabled — see
    // docs/0621/crewAI/04-optimization-recommendations.md (R9).
    InMemoryLoopsLockBackend,
    { provide: LOOPS_LOCK_BACKEND, useExisting: InMemoryLoopsLockBackend },
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
