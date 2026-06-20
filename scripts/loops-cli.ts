import { DeterministicLoopsAgentAdapter } from '../apps/api/src/modules/loops/adapters/deterministic-loops-agent.adapter';
import { DeterministicLoopsClaudeAdapter } from '../apps/api/src/modules/loops/adapters/deterministic-loops-claude.adapter';
import { CliLoopsGitAdapter } from '../apps/api/src/modules/loops/adapters/cli-loops-git.adapter';
import { LoopsFileStoreService } from '../apps/api/src/modules/loops/loops-file-store.service';
import { LoopsRunnerService } from '../apps/api/src/modules/loops/loops-runner.service';
import { LoopsService } from '../apps/api/src/modules/loops/loops.service';

type Cleanup = () => Promise<void>;

async function createLoopsService(): Promise<{
  service: LoopsService;
  cleanup: Cleanup;
}> {
  const store = new LoopsFileStoreService();
  const runner = new LoopsRunnerService();
  const agentAdapter = new DeterministicLoopsAgentAdapter();
  const claudeAdapter = new DeterministicLoopsClaudeAdapter();
  const gitAdapter = new CliLoopsGitAdapter({
    commitPerShard: process.env.LOOPS_GIT_COMMIT_PER_SHARD === 'true',
    baseBranch: process.env.LOOPS_GIT_BASE_BRANCH ?? 'main',
  });

  if (process.env.LOOPS_DB_CLI !== '1') {
    return {
      service: new LoopsService(store, runner, agentAdapter, claudeAdapter, gitAdapter),
      cleanup: async () => undefined,
    };
  }

  const requireRuntime = eval('require') as NodeRequire;
  requireRuntime('dotenv').config();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required when LOOPS_DB_CLI=1');
  }

  const { Pool } = requireRuntime('pg');
  const { PrismaPg } = requireRuntime('@prisma/adapter-pg');
  const { PrismaClient } = requireRuntime('@prisma/client');
  const { LoopsDbService } = requireRuntime('@app/db');
  const { LoopsPersistenceService } = requireRuntime(
    '../apps/api/src/modules/loops/loops-persistence.service',
  );
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const prismaService = { read: prisma, write: prisma };
  const db = new LoopsDbService(prismaService);
  const persistence = new LoopsPersistenceService(db, store);

  return {
    service: new LoopsService(store, runner, agentAdapter, claudeAdapter, gitAdapter, persistence),
    cleanup: async () => {
      await prisma.$disconnect();
      await pool.end();
    },
  };
}

async function main() {
  const command = process.argv[2] ?? 'status';
  const { service, cleanup } = await createLoopsService();

  try {
    if (command === 'status') {
      const data = await service.list({ page: 1, limit: 20 });
      console.log(
        JSON.stringify(
          {
            issues: data.total,
            loops: data.list
              .map((item) => item.state)
              .filter((state): state is NonNullable<typeof state> => Boolean(state)),
          },
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'doctor') {
      console.log(JSON.stringify(await service.doctor(), null, 2));
      return;
    }

    if (command === 'cost') {
      console.log(JSON.stringify(await service.cost(), null, 2));
      return;
    }

    if (command === 'logs') {
      const issueId = process.argv[3];
      const limit = Number(process.argv[4] ?? 50);
      console.log(
        JSON.stringify(
          await service.logs({
            issueId,
            limit: Number.isFinite(limit) ? limit : 50,
          }),
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'notifications') {
      const issueId = process.argv[3];
      const limit = Number(process.argv[4] ?? 50);
      console.log(
        JSON.stringify(
          await service.notifications({
            issueId,
            limit: Number.isFinite(limit) ? limit : 50,
          }),
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'resume') {
      console.log(JSON.stringify(await service.resume(), null, 2));
      return;
    }

    if (command === 'pause') {
      const issueId = process.argv[3];
      if (!issueId) {
        throw new Error('issueId is required for pause');
      }
      console.log(
        JSON.stringify(
          await service.intervene(issueId, {
            action: 'pause',
            actor: 'human-cli',
          }),
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'resume-loop') {
      const issueId = process.argv[3];
      if (!issueId) {
        throw new Error('issueId is required for resume-loop');
      }
      console.log(
        JSON.stringify(
          await service.intervene(issueId, {
            action: 'resume',
            actor: 'human-cli',
          }),
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'take') {
      const issueId = process.argv[3];
      const shardId = process.argv[4];
      const notes = process.argv.slice(5).join(' ').trim();
      if (!issueId || !shardId) {
        throw new Error('issueId and shardId are required for take');
      }
      console.log(
        JSON.stringify(
          await service.intervene(issueId, {
            action: 'take',
            actor: 'human-cli',
            shardId,
            notes: notes || undefined,
          }),
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'run') {
      const issueId = process.argv[3];
      if (!issueId) {
        throw new Error('issueId is required for run');
      }
      console.log(JSON.stringify(await service.runLoop(issueId), null, 2));
      return;
    }

    if (command === 'global-review') {
      const issueId = process.argv[3];
      if (!issueId) {
        throw new Error('issueId is required for global-review');
      }
      console.log(JSON.stringify(await service.reviewGlobal(issueId), null, 2));
      return;
    }

    if (command === 'reloop') {
      const issueId = process.argv[3];
      const notes = process.argv.slice(4).join(' ').trim();
      if (!issueId) {
        throw new Error('issueId is required for reloop');
      }
      console.log(
        JSON.stringify(
          await service.reloop(issueId, {
            reviewer: 'human-cli',
            notes: notes || undefined,
          }),
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'finalize') {
      const issueId = process.argv[3];
      if (!issueId) {
        throw new Error('issueId is required for finalize');
      }
      console.log(JSON.stringify(await service.finalize(issueId), null, 2));
      return;
    }

    console.error(`Unknown loops command: ${command}`);
    console.error(
      'Usage: pnpm loops:status | pnpm loops:doctor | pnpm loops:db-status | pnpm loops:db-doctor | pnpm loops:cost | pnpm loops:logs [issueId] [limit] | pnpm loops:notifications [issueId] [limit] | pnpm loops:resume | pnpm loops:pause <issueId> | pnpm loops:resume-loop <issueId> | pnpm loops:take <issueId> <shardId> [notes] | pnpm loops:run <issueId> | pnpm loops:global-review <issueId> | pnpm loops:reloop <issueId> [notes] | pnpm loops:finalize <issueId>',
    );
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
