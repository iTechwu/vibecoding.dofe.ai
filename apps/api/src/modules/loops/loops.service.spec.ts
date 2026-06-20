/**
 * TASK-07 · v1 main-chain smoke (file-only).
 *
 * Exercises the full deterministic Loops lifecycle against the `.loops` file
 * source of truth, with no DB and no real command/git execution:
 *
 *   createIssue -> generateSpec -> approve -> decompose -> runLoop -> reviewGlobal -> finalize
 *
 * The runner and git adapter are faked so the test is hermetic and repeatable;
 * the deterministic agent/claude adapters are real (they return canned MVP data).
 * This verifies Smoke 1 (intake -> `.loops`), Smoke 2 (queue/detail recovery)
 * and Smoke 3 (loop closed -> `CLOSED`/`finalized`) on the file side. The DB
 * half of the smoke (DB index + `.loops` consistency) is verified via the API
 * `GET /loops/doctor` endpoint against a migrated DB, documented in
 * `docs/0619/loops设计/todo/TASK-07-smoke-tests-and-quality-gate.md`.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { LoopConvergencePr, LoopTestRecord } from '@repo/contracts';
import { DeterministicLoopsAgentAdapter } from './adapters/deterministic-loops-agent.adapter';
import { DeterministicLoopsClaudeAdapter } from './adapters/deterministic-loops-claude.adapter';
import type {
  LoopsCommitShardResult,
  LoopsGitAdapter,
} from './adapters/loops-git-adapter.interface';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsRunnerService } from './loops-runner.service';
import { LoopsService } from './loops.service';

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

/** Hermetic runner stub: returns TEST-PASS without executing any real commands. */
function createFakeRunner() {
  const stub = {
    runShardTests: jest
      .fn()
      .mockImplementation((input: { issueId: string; shardId: string; round: number }) =>
        Promise.resolve(makePassTestRecord(input.issueId, input.shardId, input.round)),
      ),
  };
  return stub as unknown as LoopsRunnerService;
}

/** Hermetic git adapter stub: records commits and a convergence PR without touching git. */
function createFakeGitAdapter(): LoopsGitAdapter {
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

describe('LoopsService v1 main chain (file-only smoke)', () => {
  let workspace: string;
  let store: LoopsFileStoreService;
  let service: LoopsService;
  const previousEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Isolated workspace so `.loops` artifacts never touch the real repo.
    workspace = mkdtempSync(join(tmpdir(), 'loops-smoke-'));
    writeFileSync(join(workspace, 'package.json'), '{"name":"loops-smoke-ws"}');
    writeFileSync(join(workspace, 'turbo.json'), '{"pipeline":{}}');
    // `LOOPS_WORKSPACE_ROOT` selects the `.loops` file-store root; the target-repo
    // whitelist is a separate env (`LOOPS_ALLOWED_REPO_ROOTS`) — point both at the
    // temp dir so the smoke issue's `targetRepo` is accepted and isolated.
    previousEnv.LOOPS_WORKSPACE_ROOT = process.env.LOOPS_WORKSPACE_ROOT;
    previousEnv.LOOPS_ALLOWED_REPO_ROOTS = process.env.LOOPS_ALLOWED_REPO_ROOTS;
    process.env.LOOPS_WORKSPACE_ROOT = workspace;
    process.env.LOOPS_ALLOWED_REPO_ROOTS = workspace;

    store = new LoopsFileStoreService();
    service = new LoopsService(
      store,
      createFakeRunner(),
      new DeterministicLoopsAgentAdapter(),
      new DeterministicLoopsClaudeAdapter(),
      createFakeGitAdapter(),
      // persistence intentionally omitted -> file-only mode (CLI equivalent)
    );
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    rmSync(workspace, { recursive: true, force: true });
  });

  it('attributes createIssue to the authenticated SSO user, ignoring client submitter fields (dofe-sso)', async () => {
    const created = await service.createIssue(
      {
        title: 'SSO-attributed submission',
        targetRepo: workspace,
        body: 'The authenticated user must own the issue; client submitter fields are ignored.',
        priority: 'P2',
        acceptanceCriteria: ['- submitter derived server-side from AuthGuard'],
        // Client-supplied submitter must be ignored when an auth user is present.
        submitter: { provider: 'dev', userId: 'spoofed', name: 'Spoofer' },
      },
      { id: 'sso-user-42', nickname: 'Ada', code: 'ada', isAdmin: false, isAnonymity: false },
    );
    expect(created.issue.submitterId).toBe('sso-user-42');
    expect(created.issue.submitterName).toBe('Ada');
    expect(created.intake.submitter).toEqual({
      provider: 'dofe-sso',
      userId: 'sso-user-42',
      name: 'Ada',
    });
  });

  it('falls back to dev defaults when no authenticated user is present (CLI/internal path)', async () => {
    const created = await service.createIssue({
      title: 'Anonymous CLI submission',
      targetRepo: workspace,
      body: 'Without an auth user the service keeps the deterministic dev defaults.',
      priority: 'P2',
      acceptanceCriteria: ['- dev fallback preserved for unauthenticated callers'],
    });
    expect(created.issue.submitterId).toBe('dev-user');
    expect(created.intake.submitter.provider).toBe('dev');
  });

  it('runs createIssue -> generateSpec -> approve -> decompose -> runLoop -> reviewGlobal -> finalize', async () => {
    // Smoke 1 · no-login intake writes issue/intake/initial state to `.loops`.
    const created = await service.createIssue({
      title: 'Smoke test issue for v1 main chain',
      targetRepo: workspace,
      body: 'Verify the deterministic Loops lifecycle closes an issue end to end.',
      priority: 'P2',
      acceptanceCriteria: ['- Issue reaches CLOSED with finalized=true'],
    });
    expect(created.issue.status).toBe('OPEN');
    expect(created.state.phase).toBe('PHASE_1_SPEC');
    expect(created.issue.submitterId).toBe('dev-user'); // server-defaulted, no login required

    // Smoke 2 · queue (file fallback) + detail recovery survive a fresh read.
    const queued = await service.list({ page: 1, limit: 20 });
    expect(queued.total).toBe(1);
    expect(queued.list[0].issue.id).toBe(created.issue.id);
    let detail = await service.getIssue(created.issue.id);
    expect(detail.issue.id).toBe(created.issue.id);

    // generateSpec -> DRAFT spec, waiting for human review.
    detail = await service.generateSpec(created.issue.id);
    expect(detail.spec?.status).toBe('DRAFT');
    expect(detail.spec?.body).not.toContain('mock user');
    expect(detail.spec?.body).toContain('真实浏览器 SSO E2E 仍需外部联调环境验证');

    // approve -> APPROVED spec, allowed to decompose.
    detail = await service.reviewSpec(created.issue.id, { action: 'approve', reviewer: 'tester' });
    expect(detail.spec?.status).toBe('APPROVED');

    // decompose -> MVP shards (deterministic: 2 serial shards).
    detail = await service.decompose(created.issue.id);
    expect(detail.shards.length).toBeGreaterThan(0);
    const hasAccurateSsoBoundaryAnnotation = detail.annotations.some((annotation) =>
      annotation.notes.includes('dofe-sso submitter'),
    );
    expect(hasAccurateSsoBoundaryAnnotation).toBe(true);
    const shardCount = detail.shards.length;

    // runLoop advances one ready shard per call (max_parallel default = 1).
    // N calls implement+test+review shards to DONE, then one more flips to CONVERGE.
    for (let i = 0; i < shardCount + 1; i += 1) {
      try {
        detail = await service.runLoop(created.issue.id);
      } catch {
        // The final call may throw "No runnable shard" once converged; tolerate it.
      }
    }
    detail = await service.getIssue(created.issue.id);
    expect(detail.shards.every((shard) => shard.status === 'DONE')).toBe(true);

    // reviewGlobal -> PASS (evidence complete, deterministic adapter returns PASS).
    detail = await service.reviewGlobal(created.issue.id);
    expect(detail.state.globalVerdict).toBe('PASS');

    // finalize -> CLOSED terminal state.
    detail = await service.finalize(created.issue.id);
    expect(detail.issue.status).toBe('CLOSED');
    expect(detail.state.phase).toBe('CLOSED');
    expect(detail.state.finalized).toBe(true);

    // Smoke 4 · doctor reports a healthy `.loops` for the closed issue.
    const doctor = await service.doctor();
    expect(doctor.ok).toBe(true);
    expect(doctor.problems).toEqual([]);
  });
});
