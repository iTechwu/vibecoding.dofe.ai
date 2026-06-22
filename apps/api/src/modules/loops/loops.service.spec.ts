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
import type { LoopConvergencePr, LoopRuntimeDetection, LoopTestRecord } from '@repo/contracts';
import { DeterministicLoopsAgentAdapter } from './adapters/deterministic-loops-agent.adapter';
import { DeterministicLoopsClaudeAdapter } from './adapters/deterministic-loops-claude.adapter';
import type {
  LoopsCommitShardResult,
  LoopsGitAdapter,
} from './adapters/loops-git-adapter.interface';
import { AgentRuntimeDetectionService } from './agent-runtime-detection.service';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsRunnerService } from './loops-runner.service';
import { LoopsService } from './loops.service';
import { LoopsWorkLockService } from './loops-work-lock.service';
import { LoopsWorkspaceProfileService } from './loops-workspace-profile.service';

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
      new LoopsWorkLockService(),
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

  it('returns control-plane metrics for the Loops dashboard', async () => {
    const created = await service.createIssue({
      title: 'Metrics dashboard issue',
      targetRepo: workspace,
      body: 'Metrics should expose summary, phase distribution, risks, and actions.',
      priority: 'P0',
      acceptanceCriteria: ['- metrics exposes generate spec action'],
    });

    const metrics = await service.metrics();

    expect(metrics.health.ok).toBe(true);
    expect(metrics.summary.total).toBe(1);
    expect(metrics.summary.active).toBe(1);
    expect(metrics.summary.attention).toBe(2);
    expect(metrics.requirementsCoverage).toEqual({
      total: 1,
      accepted: 0,
      reviewed: 0,
      tested: 0,
      implemented: 0,
      planned: 0,
      missing: 1,
      percent: 0,
    });
    expect(metrics.traceSummary.total).toBeGreaterThan(0);
    expect(metrics.traceSummary.eventTypes).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'ISSUE_NORMALIZED' })]),
    );
    expect(metrics.resumeSummary).toEqual({ resumableShards: 0, affectedIssues: 0 });
    expect(metrics.phaseDistribution).toEqual([{ phase: 'PHASE_1_SPEC', label: 'Spec', count: 1 }]);
    expect(metrics.riskQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: created.issue.id,
          level: 'critical',
          reason: 'P0 priority',
        }),
      ]),
    );
    expect(metrics.actionQueue).toEqual([
      expect.objectContaining({
        issueId: created.issue.id,
        action: 'generate-spec',
        label: 'Generate spec',
      }),
    ]);
  });

  it('returns agent runtime status and diagnostics as a first-class backend contract', async () => {
    const created = await service.createIssue({
      title: 'Runtime diagnostics issue',
      targetRepo: workspace,
      body: 'Agent runtime should expose current agents and actionable diagnostics.',
      priority: 'P2',
      acceptanceCriteria: ['- runtime exposes agent status'],
    });
    await service.generateSpec(created.issue.id);

    const runtime = await service.agentRuntime();

    expect(runtime.summary).toEqual({
      running: 0,
      attention: 1,
      idle: 3,
      total: 4,
    });
    expect(runtime.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spec-review-agent',
          label: 'Spec Review Agent',
          status: 'attention',
          issueId: created.issue.id,
          issueTitle: created.issue.title,
          href: `/loops/${created.issue.id}`,
        }),
        expect.objectContaining({
          id: 'implementation-agent',
          status: 'idle',
        }),
      ]),
    );
    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({
        agentId: 'spec-review-agent',
        issueId: created.issue.id,
        level: 'warning',
        reason: 'Spec draft is waiting for human review',
      }),
    ]);
  });

  it('returns a capability registry with requested external items planned', async () => {
    const capabilities = await service.capabilities();
    const a2a = capabilities.capabilities.find((item) => item.id === 'a2a-tool-registry');

    expect(capabilities.summary.total).toBe(capabilities.capabilities.length);
    expect(capabilities.summary.inProgress).toBeGreaterThanOrEqual(1);
    expect(a2a).toEqual(
      expect.objectContaining({
        id: 'a2a-tool-registry',
        status: 'in-progress',
        agentToolRegistry: expect.objectContaining({
          agents: expect.arrayContaining([
            expect.objectContaining({ id: 'codex-planner-reviewer', lifecycle: 'active' }),
            expect.objectContaining({ id: 'claude-code-implementer', lifecycle: 'active' }),
          ]),
          tools: expect.arrayContaining([
            expect.objectContaining({ id: 'repo-code-editor', kind: 'code-execution' }),
            expect.objectContaining({ id: 'test-runner', kind: 'test' }),
          ]),
          compatibilityChecks: expect.arrayContaining([
            expect.objectContaining({ id: 'phase-tool-ownership', status: 'pass' }),
          ]),
        }),
      }),
    );
    expect(capabilities.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'feishu-integration', status: 'planned' }),
        expect.objectContaining({ id: 'remote-pr-diff', status: 'planned' }),
        expect.objectContaining({ id: 'worker-concurrency', status: 'planned' }),
        expect.objectContaining({ id: 'complete-span-trace', status: 'planned' }),
        expect.objectContaining({ id: 'checkpoint-snapshot-browser', status: 'planned' }),
        expect.objectContaining({ id: 'snapshot-storage-recovery', status: 'planned' }),
      ]),
    );
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
    expect(detail.evidenceArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'raw-payload', status: 'present' }),
        expect.objectContaining({
          kind: 'issue',
          status: 'present',
          summary: expect.stringContaining('initial acceptance criteria'),
        }),
        expect.objectContaining({ kind: 'intake', status: 'present' }),
      ]),
    );

    // generateSpec -> DRAFT spec, waiting for human review.
    detail = await service.generateSpec(created.issue.id);
    expect(detail.spec?.status).toBe('DRAFT');
    expect(detail.spec?.body).not.toContain('mock user');
    expect(detail.spec?.body).toContain('真实浏览器 SSO E2E 仍需外部联调环境验证');

    // approve -> APPROVED spec and wakes the engine through automated phases.
    detail = await service.reviewSpec(created.issue.id, { action: 'approve', reviewer: 'tester' });
    expect(detail.spec?.status).toBe('APPROVED');
    expect(detail.shards.length).toBeGreaterThan(0);
    expect(detail.spec?.body).toContain('dofe-sso submitter');
    expect(detail.shards.every((shard) => shard.status === 'DONE')).toBe(true);
    expect(detail.state.globalVerdict).toBe('PASS');
    expect(detail.issue.status).toBe('CLOSED');
    expect(detail.state.phase).toBe('CLOSED');
    expect(detail.state.finalized).toBe(true);
    expect(detail.evidenceArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'global-review', status: 'present' }),
        expect.objectContaining({
          kind: 'convergence-pr',
          status: 'present',
          summary: expect.stringContaining('Convergence package references'),
        }),
      ]),
    );

    // Smoke 4 · doctor reports a healthy `.loops` for the closed issue.
    const doctor = await service.doctor();
    expect(doctor.ok).toBe(true);
    expect(doctor.problems).toEqual([]);
  });

  // ---- 0622 · B1/B2/B4: runtime profile, detection facts, simple intake ----

  /** A LoopsService wired with a real workspace profile + a stub detection service. */
  function buildRuntimeService(stubRuntimes: LoopRuntimeDetection[]) {
    const profile = new LoopsWorkspaceProfileService();
    const detection = {
      detectAll: async () => stubRuntimes,
    } as unknown as AgentRuntimeDetectionService;
    return new LoopsService(
      store,
      createFakeRunner(),
      new LoopsWorkLockService(),
      new DeterministicLoopsAgentAdapter(),
      new DeterministicLoopsClaudeAdapter(),
      createFakeGitAdapter(),
      // persistence omitted (file-only), capabilityRegistry + logger left to defaults.
      undefined,
      undefined,
      undefined,
      detection,
      profile,
    );
  }

  it('createSimpleIssue normalises a one-sentence request and derives the SSO submitter', async () => {
    const runtimeService = buildRuntimeService([]);
    const created = await runtimeService.createSimpleIssue(
      { request: '修复登录后跳转异常。需要回归测试。', template: 'auto' },
      { id: 'sso-user-7', nickname: 'Grace', code: 'grace', isAdmin: false, isAnonymity: false },
    );
    expect(created.issue.title).toBe('修复登录后跳转异常');
    expect(created.issue.priority).toBe('P0'); // bugfix inferred
    expect(created.issue.body).toBe('修复登录后跳转异常。需要回归测试。');
    expect(created.issue.targetRepo).toBe(workspace); // resolved from default workspace
    expect(created.issue.submitterId).toBe('sso-user-7');
    expect(created.issue.acceptanceCriteria.length).toBeGreaterThan(0);
  });

  it('listWorkspaces returns the default workspace and agentRuntime surfaces detection facts', async () => {
    const stubRuntimes: LoopRuntimeDetection[] = [
      {
        agent: 'codex',
        preferredMode: 'local-cli',
        local: { mode: 'local-cli', status: 'ready', workspaceRequired: false },
        checks: [],
      },
    ];
    const runtimeService = buildRuntimeService(stubRuntimes);

    const workspaces = await runtimeService.listWorkspaces();
    expect(workspaces.current).toBe('default');
    expect(workspaces.workspaces[0].root).toBe(workspace);

    const runtime = await runtimeService.agentRuntime();
    expect(runtime.workspaceId).toBe('default');
    expect(runtime.runtimes).toHaveLength(1);
    expect(runtime.runtimes?.[0].agent).toBe('codex');
  });

  it('recovers interrupted shards automatically when running the loop', async () => {
    const created = await service.createIssue({
      title: 'Recover interrupted shard',
      targetRepo: workspace,
      body: 'The loop engine should recover interrupted shard work without asking humans to fill shard forms.',
      priority: 'P2',
      acceptanceCriteria: ['- interrupted shard is automatically returned to scheduler control'],
    });
    const planned = await service.generateSpec(created.issue.id);
    if (!planned.spec) {
      throw new Error('expected generated spec');
    }
    await store.writeSpec(
      planned.issue,
      { ...planned.spec, status: 'APPROVED', approvedBy: 'tester' },
      {
        ...planned.state,
        phase: 'PHASE_3_DECOMPOSE',
        updated: new Date().toISOString(),
      },
    );
    const decomposed = await service.decompose(created.issue.id);
    const interruptedShard = decomposed.shards[0];

    await store.writeShardProgress({
      issueId: created.issue.id,
      shardId: interruptedShard.id,
      from: interruptedShard.status,
      to: 'IN_PROGRESS',
      actor: 'test',
      shards: decomposed.shards.map((shard) =>
        shard.id === interruptedShard.id ? { ...shard, status: 'IN_PROGRESS' as const } : shard,
      ),
      state: {
        ...decomposed.state,
        phase: 'PHASE_4_IMPLEMENT',
        shardsInProgress: 1,
        updated: new Date().toISOString(),
      },
    });

    const detail = await service.runLoop(created.issue.id);

    expect(detail.shards.find((shard) => shard.id === interruptedShard.id)?.status).toBe('DONE');
    expect(detail.state.shardsInProgress).toBe(0);
    expect(
      detail.logs.some((entry) => entry.type === 'SCHEDULER_RECOVERED_INTERRUPTED_SHARDS'),
    ).toBe(true);
  });

  it('advances the loop to the next human gate or terminal state', async () => {
    const created = await service.createIssue({
      title: 'Advance Loop Engineering issue',
      targetRepo: workspace,
      body: 'The product-level advance action should automate everything except spec approval.',
      priority: 'P2',
      acceptanceCriteria: ['- users only approve the spec manually'],
    });

    let detail = await service.advance(created.issue.id);
    expect(detail.spec?.status).toBe('DRAFT');
    expect(detail.state.phase).toBe('PHASE_2_REVIEW');

    detail = await service.advance(created.issue.id);
    expect(detail.spec?.status).toBe('DRAFT');
    expect(detail.state.phase).toBe('PHASE_2_REVIEW');
    expect(detail.shards).toHaveLength(0);

    await service.reviewSpec(created.issue.id, { action: 'approve', reviewer: 'tester' });

    detail = await service.advance(created.issue.id);
    expect(detail.shards.every((shard) => shard.status === 'DONE')).toBe(true);
    expect(detail.issue.status).toBe('CLOSED');
    expect(detail.state.finalized).toBe(true);
  });

  it('continues automatically after spec approval without requiring another user click', async () => {
    const created = await service.createIssue({
      title: 'Approve once and let the engine run',
      targetRepo: workspace,
      body: 'After human approval the engine should continue through automated phases.',
      priority: 'P2',
      acceptanceCriteria: ['- approval wakes the engine'],
    });
    await service.advance(created.issue.id);

    const detail = await service.reviewSpec(created.issue.id, {
      action: 'approve',
      reviewer: 'tester',
    });

    expect(detail.spec?.status).toBe('APPROVED');
    expect(detail.shards.every((shard) => shard.status === 'DONE')).toBe(true);
    expect(detail.issue.status).toBe('CLOSED');
    expect(detail.state.finalized).toBe(true);
  });

  it('keeps granular compatibility endpoints idempotent after automatic finalization', async () => {
    const created = await service.createIssue({
      title: 'Legacy granular endpoints after auto advance',
      targetRepo: workspace,
      body: 'Older clients may still call phase-specific endpoints after approval auto-runs.',
      priority: 'P2',
      acceptanceCriteria: ['- terminal loops stay closed'],
    });
    await service.advance(created.issue.id);
    const finalized = await service.reviewSpec(created.issue.id, {
      action: 'approve',
      reviewer: 'tester',
    });
    expect(finalized.issue.status).toBe('CLOSED');

    const afterDecompose = await service.decompose(created.issue.id);
    const afterRun = await service.runLoop(created.issue.id);
    const afterGlobalReview = await service.reviewGlobal(created.issue.id);
    const afterFinalize = await service.finalize(created.issue.id);

    for (const detail of [afterDecompose, afterRun, afterGlobalReview, afterFinalize]) {
      expect(detail.issue.status).toBe('CLOSED');
      expect(detail.state.phase).toBe('CLOSED');
      expect(detail.state.finalized).toBe(true);
      expect(detail.shards.every((shard) => shard.status === 'DONE')).toBe(true);
    }
  });
});
