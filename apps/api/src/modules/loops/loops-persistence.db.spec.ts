/**
 * TASK-07 · v1 DB-side smoke (integration, gated).
 *
 * Runs ONLY when `LOOPS_DB_SMOKE=1` is set, against the live DB pointed at by
 * `apps/api/.env` `DATABASE_URL`. It is skipped in the normal `pnpm test:api`
 * run so CI without a DB stays green.
 *
 * Why a Jest spec (not a ts-node script): Jest's `moduleNameMapper` is built
 * from the api `tsconfig` paths, so `@prisma/client` -> generated client and
 * `@app/db` -> generated/db resolve correctly here (plain ts-node does not),
 * letting us exercise the REAL `LoopsPersistenceService` + `LoopsDbService`.
 *
 * Verifies the DB half of Smoke 1/3/4:
 *  - createIssue -> DB `loop_issue` + `loop_issue_intake` + `loop_state` rows.
 *  - list / readDetail read from the DB index.
 *  - full lifecycle -> DB `LoopIssue.status=CLOSED`, `LoopState.phase=CLOSED`,
 *    `finalized=true`.
 *  - doctor reports ok on a consistent state and flags a DB/`.loops` mismatch
 *    when a DB state row is removed.
 */
import 'dotenv/config';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '@dofe/infra-prisma';
import type { LoopConvergencePr, LoopTestRecord } from '@repo/contracts';
import { LoopsDbService } from '@app/db';
import { DeterministicLoopsAgentAdapter } from './adapters/deterministic-loops-agent.adapter';
import { DeterministicLoopsClaudeAdapter } from './adapters/deterministic-loops-claude.adapter';
import type {
  LoopsCommitShardResult,
  LoopsGitAdapter,
} from './adapters/loops-git-adapter.interface';
import { LoopsFileStoreService } from '@app/services/loops-store';
import { LoopsPersistenceService } from '@app/services/loops-store';
import { LoopsRunnerService } from './loops-runner.service';
import { LoopsService } from './loops.service';
import { LoopsWorkLockService } from '@app/services/loops-locks';

const RUN = process.env.LOOPS_DB_SMOKE === '1';
const describeDb = RUN ? describe : describe.skip;

/** Minimal PrismaService stand-in: a single generated client serves read+write. */
function makePrismaService(client: PrismaClient): PrismaService {
  return { read: client, write: client } as unknown as PrismaService;
}

function makePassTestRecord(issueId: string, shardId: string, round: number): LoopTestRecord {
  return {
    id: `test-record-${shardId}-r${round}`,
    issueId,
    shardId,
    round,
    runner: 'loops-runner',
    reviewer: 'system',
    status: 'TEST-PASS',
    commands: [
      {
        command: 'pnpm test',
        exitCode: 0,
        durationMs: 1,
        stdout: 'Lines: 100% Branches: 100%',
        stderr: '',
      },
    ],
    coverage: { lines: 100, branches: 100 },
    failedTests: [],
    fixInstructions: [],
    created: new Date().toISOString(),
  };
}

function makeFakeRunner() {
  return {
    runShardTests: jest
      .fn()
      .mockImplementation((input: { issueId: string; shardId: string; round: number }) =>
        Promise.resolve(makePassTestRecord(input.issueId, input.shardId, input.round)),
      ),
  } as unknown as LoopsRunnerService;
}

function makeFakeGitAdapter(): LoopsGitAdapter {
  return {
    commitShard: async ({ shard }): Promise<LoopsCommitShardResult> => ({
      shardId: shard.id,
      committed: false,
      message: `chore(loops): ${shard.id}`,
      branch: 'main',
    }),
    createConvergencePr: async ({ issue }): Promise<LoopConvergencePr> => ({
      id: `conv-${issue.id}`,
      issueId: issue.id,
      branch: `loops/${issue.id}`,
      baseBranch: 'main',
      commits: [],
      annotationsSummary: 'ok',
      prBody: 'convergence',
      status: 'DRAFT',
      created: new Date().toISOString(),
    }),
  };
}

describeDb('LoopsPersistence DB smoke (live DB)', () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let workspace: string | undefined;
  let service: LoopsService;
  let persistence: LoopsPersistenceService;
  const createdIssueIds: string[] = [];
  const previousEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    // The generated client uses driver adapters (see prisma/seed.ts) -> construct
    // it with the pg adapter backed by the `DATABASE_URL` from apps/api/.env.
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set; run with LOOPS_DB_SMOKE=1 against a configured DB');
    }
    pool = new Pool({ connectionString });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (pool) {
      await pool.end().catch(() => undefined);
    }
  });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'loops-dbsmoke-'));
    writeFileSync(join(workspace, 'package.json'), '{"name":"loops-dbsmoke-ws"}');
    writeFileSync(join(workspace, 'turbo.json'), '{"pipeline":{}}');
    previousEnv.LOOPS_WORKSPACE_ROOT = process.env.LOOPS_WORKSPACE_ROOT;
    previousEnv.LOOPS_ALLOWED_REPO_ROOTS = process.env.LOOPS_ALLOWED_REPO_ROOTS;
    process.env.LOOPS_WORKSPACE_ROOT = workspace;
    process.env.LOOPS_ALLOWED_REPO_ROOTS = workspace;

    const store = new LoopsFileStoreService();
    const db = new LoopsDbService(makePrismaService(prisma));
    persistence = new LoopsPersistenceService(db, store);
    service = new LoopsService(
      store,
      makeFakeRunner(),
      new LoopsWorkLockService(),
      new DeterministicLoopsAgentAdapter(),
      new DeterministicLoopsClaudeAdapter(),
      makeFakeGitAdapter(),
      persistence,
    );
  });

  afterEach(async () => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspace = undefined;
    // Clean this test's DB rows immediately: tests share one DB but each uses a
    // fresh `.loops` workspace, so leftover DB rows would make the next test's
    // doctor (DB vs `.loops`) report false mismatches. CASCADE drops intake+state.
    if (prisma) {
      for (const id of createdIssueIds.splice(0)) {
        await prisma.loopIssue.deleteMany({ where: { id } }).catch(() => undefined);
      }
    }
  });

  const remember = (issueId: string) => {
    if (!createdIssueIds.includes(issueId)) createdIssueIds.push(issueId);
  };

  it('writes Issue/Intake/LoopState to the DB and reads them back', async () => {
    const created = await service.createIssue({
      title: 'DB smoke issue',
      targetRepo: workspace,
      body: 'Verify Loops DB persistence against the live DB.',
      priority: 'P2',
      acceptanceCriteria: ['- DB rows exist for issue/intake/state'],
    });
    remember(created.issue.id);

    // Smoke 1 (DB side) · three tables were written.
    const [issue, intake, state] = await Promise.all([
      prisma.loopIssue.findUnique({ where: { id: created.issue.id } }),
      prisma.loopIssueIntake.findFirst({ where: { issueId: created.issue.id } }),
      prisma.loopState.findUnique({ where: { issueId: created.issue.id } }),
    ]);
    expect(issue).not.toBeNull();
    expect(issue?.status).toBe('OPEN');
    expect(issue?.submitterId).toBe('dev-user');
    expect(intake).not.toBeNull();
    expect(intake?.submitterProvider).toBe('dev');
    expect(state).not.toBeNull();
    expect(state?.phase).toBe('PHASE_1_SPEC');

    // list/readDetail read from the DB index.
    const queued = await service.list({ page: 1, limit: 20 });
    expect(queued.total).toBeGreaterThanOrEqual(1);
    expect(queued.list.some((item) => item.issue.id === created.issue.id)).toBe(true);
    const detail = await service.getIssue(created.issue.id);
    expect(detail.issue.id).toBe(created.issue.id);
  });

  it('closes the lifecycle and syncs CLOSED/finalized to the DB', async () => {
    const created = await service.createIssue({
      title: 'DB smoke lifecycle issue',
      targetRepo: workspace,
      body: 'Run the deterministic lifecycle and assert DB CLOSED state.',
      priority: 'P1',
      acceptanceCriteria: ['- finalize writes CLOSED/finalized to DB'],
    });
    remember(created.issue.id);

    await service.generateSpec(created.issue.id);
    await service.reviewSpec(created.issue.id, { action: 'approve', reviewer: 'tester' });
    const decomposed = await service.decompose(created.issue.id);
    const shardCount = decomposed.shards.length;
    for (let i = 0; i < shardCount + 1; i += 1) {
      try {
        await service.runLoop(created.issue.id);
      } catch {
        /* converged / no runnable shard */
      }
    }
    await service.reviewGlobal(created.issue.id);
    await service.finalize(created.issue.id);

    // Smoke 3 (DB side) · DB reflects the terminal state.
    const [issue, state] = await Promise.all([
      prisma.loopIssue.findUnique({ where: { id: created.issue.id } }),
      prisma.loopState.findUnique({ where: { issueId: created.issue.id } }),
    ]);
    expect(issue?.status).toBe('CLOSED');
    expect(issue?.closedAt).not.toBeNull();
    expect(state?.phase).toBe('CLOSED');
    expect(state?.finalized).toBe(true);

    // Smoke 4 (DB side) · doctor is ok on a consistent closed issue.
    const doctorOk = await service.doctor();
    expect(doctorOk.ok).toBe(true);
  });

  it('doctor flags a DB/`.loops` mismatch when a DB state row is removed', async () => {
    const created = await service.createIssue({
      title: 'DB smoke doctor issue',
      targetRepo: workspace,
      body: 'Remove a DB state row and assert doctor reports the mismatch.',
      priority: 'P2',
      acceptanceCriteria: ['- doctor detects missing DB state'],
    });
    remember(created.issue.id);

    const before = await service.doctor();
    expect(before.ok).toBe(true);

    // Artificially corrupt: drop the DB loop_state row.
    await prisma.loopState.delete({ where: { issueId: created.issue.id } });

    const after = await service.doctor();
    expect(after.ok).toBe(false);
    expect(after.problems.some((p) => p.includes(created.issue.id))).toBe(true);
    expect(after.dbProblems.length + after.consistencyProblems.length).toBeGreaterThan(0);
  });
});
