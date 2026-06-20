import { Module } from '@nestjs/common';
import { LoopsDbModule } from '@app/db';
import { AuditLogModule } from '@app/audit-log';
import { CliLoopsAgentAdapter } from './adapters/cli-loops-agent.adapter';
import { CliLoopsClaudeAdapter } from './adapters/cli-loops-claude.adapter';
import { CliLoopsGitAdapter } from './adapters/cli-loops-git.adapter';
import { DeterministicLoopsClaudeAdapter } from './adapters/deterministic-loops-claude.adapter';
import { DeterministicLoopsAgentAdapter } from './adapters/deterministic-loops-agent.adapter';
import { LOOPS_AGENT_ADAPTER } from './adapters/loops-agent-adapter.interface';
import { LOOPS_CLAUDE_ADAPTER } from './adapters/loops-claude-adapter.interface';
import { LOOPS_GIT_ADAPTER } from './adapters/loops-git-adapter.interface';
import { LoopsController } from './loops.controller';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsPersistenceService } from './loops-persistence.service';
import { LOOPS_PERSISTENCE } from './loops-persistence.token';
import { LoopsRbacGuard } from './loops-rbac.guard';
import { LoopsRunnerService } from './loops-runner.service';
import { LoopsService } from './loops.service';

@Module({
  imports: [LoopsDbModule, AuditLogModule],
  controllers: [LoopsController],
  providers: [
    LoopsService,
    LoopsFileStoreService,
    LoopsPersistenceService,
    LoopsRbacGuard,
    // Alias the concrete persistence service to the injection token used by
    // `LoopsService`, so the DB-backed implementation is only pulled into the
    // NestJS graph and never into standalone `ts-node` consumers.
    { provide: LOOPS_PERSISTENCE, useExisting: LoopsPersistenceService },
    LoopsRunnerService,
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
      useFactory: () =>
        new CliLoopsGitAdapter({
          commitPerShard: process.env.LOOPS_GIT_COMMIT_PER_SHARD === 'true',
          baseBranch: process.env.LOOPS_GIT_BASE_BRANCH ?? 'main',
        }),
    },
  ],
})
export class LoopsModule {}
