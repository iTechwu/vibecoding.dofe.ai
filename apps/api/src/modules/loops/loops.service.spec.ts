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
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
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
import { LoopsBrowserQaWorkerService } from './loops-browser-qa-worker.service';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsRunnerService } from './loops-runner.service';
import { LoopsSecondOpinionWorkerService } from './loops-second-opinion-worker.service';
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

function createFakeBrowserQaWorker(status: 'passed' | 'failed' | 'blocked' = 'passed') {
  return {
    run: jest.fn(async (input: Parameters<LoopsBrowserQaWorkerService['run']>[0]) => ({
      id: input.reportId,
      issueId: input.issueId,
      runner: 'playwright-cli' as const,
      status,
      targetUrl: input.request.targetUrl,
      title: 'QA target',
      screenshots: status === 'blocked' ? [] : [{ path: input.screenshotRef, label: 'page-load' }],
      consoleErrors: status === 'failed' ? ['Hydration failed'] : [],
      networkFailures: [],
      checkedFlows: input.request.checkedFlows,
      blockedReason: status === 'blocked' ? 'Playwright browser unavailable' : undefined,
      command: 'fake-playwright',
      durationMs: 1,
      traces: status === 'blocked' ? [] : [{ path: input.traceRef, label: 'page-load' }],
      visualDiffs:
        status === 'blocked'
          ? []
          : [
              {
                baselinePath: input.baselineRef,
                actualPath: input.screenshotRef,
                diffPath: input.diffRef,
                status: 'changed' as const,
                label: 'page-load',
              },
            ],
      handoffs:
        status === 'blocked' ? [] : [{ path: input.handoffRef, label: 'playwright-context' }],
      created: new Date().toISOString(),
    })),
  } as unknown as LoopsBrowserQaWorkerService;
}

function createFakeSecondOpinionWorker(status: 'passed' | 'needs_changes' = 'passed') {
  return {
    run: jest.fn(async (input: Parameters<LoopsSecondOpinionWorkerService['run']>[0]) => ({
      id: `${input.detail.issue.id}-second-opinion`,
      status,
      primary: input.primary,
      secondary: {
        role: 'secondary' as const,
        reviewer: 'claude-code' as const,
        status,
        findingsCount: status === 'needs_changes' ? 1 : 0,
        findings:
          status === 'needs_changes'
            ? [
                {
                  fingerprint: 'secondary-finding',
                  severity: 'major' as const,
                  desc: 'Secondary reviewer found a change request.',
                },
              ]
            : [],
        evidenceIds: [`${input.detail.issue.id}-second-opinion`],
        summary: 'Claude Code secondary review completed.',
      },
      comparison: {
        agreementCount: 0,
        primaryOnlyCount: input.primary.findingsCount,
        secondaryOnlyCount: status === 'needs_changes' ? 1 : 0,
        conflictCount: 0,
        agreementFingerprints: [],
        primaryOnlyFingerprints: input.primary.findings.map((finding) => finding.fingerprint),
        secondaryOnlyFingerprints: status === 'needs_changes' ? ['secondary-finding'] : [],
        conflictFingerprints: [],
      },
      requiredForRelease: false,
      updated: new Date().toISOString(),
    })),
  } as unknown as LoopsSecondOpinionWorkerService;
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
      undefined,
      undefined,
      undefined,
      undefined,
      new LoopsWorkspaceProfileService(),
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

  it('captures a per-loop rule snapshot for agent-readable enforcement', async () => {
    writeFileSync(join(workspace, 'AGENTS.md'), '# Agent rules\nFollow workspace guidance.');
    const created = await service.createIssue({
      title: 'Rule snapshot issue',
      targetRepo: workspace,
      body: 'Every loop should retain the workspace rules visible when it was created.',
      priority: 'P1',
      acceptanceCriteria: ['- intake includes a rule snapshot for agents'],
    });

    const detail = await service.getIssue(created.issue.id);

    expect(created.intake.ruleSnapshot).toMatchObject({
      workspaceId: 'default',
      root: workspace,
      present: 1,
      total: 4,
      enforcement: {
        policy: 'snapshot-required',
        status: 'enforced',
        agentReadable: true,
        evidence: ['AGENTS.md'],
      },
    });
    expect(detail.intake.ruleSnapshot?.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'agents',
          status: 'present',
          summary: '# Agent rules',
        }),
      ]),
    );
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
        nextActionCategory: 'continue',
        label: 'Continue loop',
      }),
    ]);
  });

  it('uses user-facing action labels in the dashboard action queue', async () => {
    const cases = [
      { title: 'Needs planning', phase: 'PHASE_3_DECOMPOSE', label: 'Continue loop' },
      { title: 'Needs final review', phase: 'PHASE_6_CONVERGE', label: 'Continue loop' },
      { title: 'Needs delivery finish', phase: 'PHASE_4_IMPLEMENT', label: 'Continue loop' },
      { title: 'Needs continuation', phase: 'PHASE_4_IMPLEMENT', label: 'Continue loop' },
    ];

    for (const item of cases) {
      const created = await service.createIssue({
        title: item.title,
        targetRepo: workspace,
        body: `${item.title} should expose a product-level next action.`,
        priority: 'P2',
        acceptanceCriteria: ['- action queue label is user-facing'],
      });
      await store.upsertState({
        ...created.state,
        phase: item.phase,
        specVersion: 'v1',
        globalVerdict: item.title === 'Needs delivery finish' ? 'PASS' : undefined,
        finalized: false,
        updated: new Date().toISOString(),
      });
    }

    const metrics = await service.metrics();
    expect(metrics.actionQueue).toEqual(
      expect.arrayContaining(
        cases.map((item) =>
          expect.objectContaining({
            title: item.title,
            label: item.label,
          }),
        ),
      ),
    );
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
    expect(queued.list[0].workflowRecipe).toMatchObject({
      id: 'default-feature',
      source: 'loop-snapshot',
      steps: expect.arrayContaining([
        expect.objectContaining({ kind: 'spec_review', owner: 'codex', status: 'current' }),
        expect.objectContaining({ kind: 'implementation', owner: 'claude-code' }),
      ]),
    });
    expect(queued.list[0].reviewGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'product', reviewer: 'human', status: 'pending' }),
        expect.objectContaining({ kind: 'code', reviewer: 'codex', status: 'pending' }),
      ]),
    );
    expect(queued.list[0].releaseGate).toMatchObject({
      status: 'pending',
      checklist: expect.objectContaining({ specApproved: false, implementationEvidence: false }),
    });
    let detail = await service.getIssue(created.issue.id);
    expect(detail.issue.id).toBe(created.issue.id);
    expect(detail.workflowRecipe).toMatchObject({
      source: 'loop-snapshot',
      capturedAt: created.issue.created,
      steps: expect.arrayContaining([
        expect.objectContaining({ kind: 'spec_review', status: 'current' }),
      ]),
    });
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
    expect(detail.workflowRecipe?.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'implementation', owner: 'claude-code', status: 'passed' }),
        expect.objectContaining({ kind: 'release_gate', owner: 'codex', status: 'passed' }),
      ]),
    );
    expect(detail.workflowRecipe).toMatchObject({
      source: 'loop-snapshot',
      capturedAt: created.issue.created,
    });
    expect(detail.reviewGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'product', status: 'passed' }),
        expect.objectContaining({ kind: 'code', reviewer: 'codex', status: 'passed' }),
        expect.objectContaining({ kind: 'security', reviewer: 'codex', status: 'passed' }),
      ]),
    );
    expect(detail.releaseGate).toMatchObject({
      status: 'shipped',
      checklist: expect.objectContaining({
        specApproved: true,
        implementationEvidence: true,
        testsPassed: true,
        requiredReviewsPassed: true,
        secondOpinionPassed: true,
        browserQaPassed: true,
      }),
    });
    expect(detail.secondOpinion).toMatchObject({
      status: 'not_required',
      requiredForRelease: false,
      primary: expect.objectContaining({
        reviewer: 'codex',
        status: 'passed',
        evidenceIds: expect.arrayContaining([expect.stringContaining('global-review')]),
      }),
      secondary: expect.objectContaining({
        reviewer: 'claude-code',
        status: 'pending',
      }),
      comparison: expect.objectContaining({
        conflictCount: 0,
        secondaryOnlyCount: 0,
      }),
    });
    expect(detail.evidenceArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'global-review', status: 'present' }),
        expect.objectContaining({ kind: 'implementation-record', round: 1 }),
        expect.objectContaining({ kind: 'test-record', round: 1 }),
        expect.objectContaining({ kind: 'review-record', round: 1 }),
        expect.objectContaining({ kind: 'global-review', round: 1 }),
        expect.objectContaining({
          kind: 'convergence-pr',
          status: 'present',
          summary: expect.stringContaining('Convergence package references'),
        }),
      ]),
    );
    expect(detail.learnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'decision',
          summary: expect.stringContaining('Loop finalized with global verdict PASS'),
          fingerprint: expect.stringMatching(/^[a-f0-9]{16}$/),
          tags: expect.arrayContaining(['decision']),
          evidenceIds: expect.arrayContaining([`${created.issue.id}-convergence-pr`]),
        }),
        expect.objectContaining({
          kind: 'test_policy',
          fingerprint: expect.stringMatching(/^[a-f0-9]{16}$/),
          tags: expect.arrayContaining(['test', 'policy']),
          evidenceIds: expect.arrayContaining([expect.stringContaining('test-record')]),
        }),
      ]),
    );

    // Smoke 4 · doctor reports a healthy `.loops` for the closed issue.
    const doctor = await service.doctor();
    expect(doctor.ok).toBe(true);
    expect(doctor.problems).toEqual([]);
  });

  it('applies learning governance to recent learning recall', async () => {
    const runtimeService = buildRuntimeService([]);
    const created = await runtimeService.createIssue({
      title: 'Govern learning memory',
      targetRepo: workspace,
      body: 'Finalized loops should produce learnings that humans can dismiss or merge.',
      priority: 'P2',
      acceptanceCriteria: ['- stale learnings can be governed out of recall'],
    });

    await runtimeService.advance(created.issue.id);
    const finalized = await runtimeService.reviewSpec(created.issue.id, {
      action: 'approve',
      reviewer: 'tester',
    });
    const decisionLearning = finalized.learnings.find((learning) => learning.kind === 'decision');
    const testPolicyLearning = finalized.learnings.find(
      (learning) => learning.kind === 'test_policy',
    );
    expect(decisionLearning).toBeDefined();
    expect(testPolicyLearning).toBeDefined();

    let workspaces = await runtimeService.listWorkspaces();
    expect(workspaces.recentLearnings?.map((learning) => learning.id)).toEqual(
      expect.arrayContaining([decisionLearning!.id, testPolicyLearning!.id]),
    );
    expect(
      workspaces.recentLearnings?.find((learning) => learning.id === decisionLearning!.id),
    ).toEqual(
      expect.objectContaining({
        fingerprint: expect.stringMatching(/^[a-f0-9]{16}$/),
        tags: expect.arrayContaining(['decision']),
        similarLearningIds: expect.any(Array),
      }),
    );

    workspaces = await runtimeService.governLearning(decisionLearning!.id, {
      action: 'dismiss',
      actor: 'tester',
      reason: 'Covered by a newer delivery decision',
    });
    expect(workspaces.learningGovernance?.dismissed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ learningId: decisionLearning!.id, actor: 'tester' }),
      ]),
    );
    expect(workspaces.recentLearnings?.map((learning) => learning.id)).not.toContain(
      decisionLearning!.id,
    );

    workspaces = await runtimeService.governLearning(testPolicyLearning!.id, {
      action: 'merge',
      actor: 'tester',
      targetLearningId: decisionLearning!.id,
    });
    expect(workspaces.learningGovernance?.merges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceLearningId: testPolicyLearning!.id,
          targetLearningId: decisionLearning!.id,
        }),
      ]),
    );
    expect(workspaces.recentLearnings?.map((learning) => learning.id)).not.toContain(
      testPolicyLearning!.id,
    );
  });

  it('surfaces runtime security blocked commands in list exception metadata', async () => {
    const runtimeService = buildRuntimeService([]);
    const created = await runtimeService.createIssue({
      title: 'Runtime security exception',
      targetRepo: workspace,
      body: 'Blocked test commands should appear in dashboard exception metadata.',
      priority: 'P1',
      acceptanceCriteria: ['- runtime security failures are visible in list payload'],
    });
    await store.writeTestRecord({
      issueId: created.issue.id,
      shardId: 'shard-runtime-security',
      record: {
        id: 'test-record-runtime-security-r1',
        issueId: created.issue.id,
        shardId: 'shard-runtime-security',
        round: 1,
        runner: 'loops-runner',
        reviewer: 'system',
        status: 'TEST-FAIL',
        commands: [
          {
            command: 'pnpm test && rm -rf /tmp/out',
            exitCode: null,
            durationMs: 0,
            stdout: '',
            stderr: 'Blocked by runtime command policy',
          },
        ],
        failedTests: [
          {
            name: 'runtime-security:command-policy',
            reason: 'Command "pnpm test && rm -rf /tmp/out" was blocked by runtime policy.',
          },
        ],
        fixInstructions: ['Remove shell control operators and rerun tests.'],
        created: '2026-06-23T00:00:00.000Z',
      },
      annotations: [],
      shards: [],
      state: created.state,
    });

    const list = await runtimeService.list({ page: 1, limit: 20 });

    expect(list.list[0].runtimeSecurityExceptions).toEqual([
      expect.objectContaining({
        testRecordId: 'test-record-runtime-security-r1',
        level: 'warning',
        reason: expect.stringContaining('blocked by runtime policy'),
        command: 'pnpm test && rm -rf /tmp/out',
      }),
    ]);
  });

  // ---- 0622 · B1/B2/B4: runtime profile, detection facts, simple intake ----

  /** A LoopsService wired with a real workspace profile + a stub detection service. */
  function buildRuntimeService(
    stubRuntimes: LoopRuntimeDetection[],
    browserQaWorker?: LoopsBrowserQaWorkerService,
    secondOpinionWorker?: LoopsSecondOpinionWorkerService,
  ) {
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
      browserQaWorker,
      secondOpinionWorker,
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

  it('runs the learning auto-merge worker into pending approvals', async () => {
    const runtimeService = buildRuntimeService([]);
    await store.ensureInitialized();
    mkdirSync(join(workspace, '.loops', 'learnings'), { recursive: true });
    writeFileSync(
      join(workspace, '.loops', 'learnings', 'manual.json'),
      JSON.stringify(
        [
          {
            id: 'learning-a',
            workspaceId: 'default',
            repo: workspace,
            kind: 'pattern',
            summary: 'Use Browser QA trace evidence for release review',
            evidenceIds: [],
            confidence: 0.9,
            createdAt: '2026-06-23T00:00:00.000Z',
          },
          {
            id: 'learning-b',
            workspaceId: 'default',
            repo: workspace,
            kind: 'pattern',
            summary: 'Use Browser QA trace evidence for release checklist',
            evidenceIds: [],
            confidence: 0.8,
            createdAt: '2026-06-23T00:01:00.000Z',
          },
        ],
        null,
        2,
      ),
    );

    const result = await runtimeService.runLearningAutoMergeWorker();

    expect(result.learningGovernance?.autoMergeCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'pending-approval',
          sourceLearningId: expect.stringMatching(/^learning-/),
          targetLearningId: expect.stringMatching(/^learning-/),
        }),
      ]),
    );
  });

  it('runs report-only Browser QA and stores evidence on the loop detail', async () => {
    const browserQaWorker = createFakeBrowserQaWorker('passed');
    const runtimeService = buildRuntimeService([], browserQaWorker);
    const created = await runtimeService.createIssue({
      title: 'Browser QA issue',
      targetRepo: workspace,
      body: 'The loop should persist a report-only browser QA artifact.',
      priority: 'P2',
      acceptanceCriteria: ['- Browser QA report is written to .loops evidence'],
    });

    const detail = await runtimeService.runBrowserQa(created.issue.id, {
      targetUrl: 'https://example.com',
      checkedFlows: ['page-load'],
    });

    expect(browserQaWorker.run).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: created.issue.id,
        targetRepo: workspace,
        request: expect.objectContaining({ targetUrl: 'https://example.com' }),
        screenshotRef: expect.stringContaining('.loops/runs/'),
        traceRef: expect.stringContaining('.loops/runs/'),
        baselineRef: expect.stringContaining('baseline-page-load.png'),
        diffRef: expect.stringContaining('visual-diff.png'),
        handoffRef: expect.stringContaining('handoff.json'),
      }),
    );
    expect(detail.browserQaReports?.[0]).toMatchObject({
      status: 'passed',
      targetUrl: 'https://example.com',
      title: 'QA target',
      screenshots: [expect.objectContaining({ label: 'page-load' })],
      traces: [
        expect.objectContaining({
          label: 'page-load',
          path: expect.stringContaining('trace.zip'),
        }),
      ],
      visualDiffs: [
        expect.objectContaining({
          status: 'changed',
          diffPath: expect.stringContaining('visual-diff.png'),
        }),
      ],
      handoffs: [expect.objectContaining({ path: expect.stringContaining('handoff.json') })],
    });
    expect(detail.evidenceArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'browser-qa',
          status: 'present',
          summary: expect.stringContaining('passed browser QA'),
        }),
      ]),
    );
    expect(detail.releaseGate?.checklist.browserQaPassed).toBe(true);
  });

  it('runs a Claude Code second-opinion worker and stores evidence on the loop detail', async () => {
    const secondOpinionWorker = createFakeSecondOpinionWorker('passed');
    const runtimeService = buildRuntimeService([], undefined, secondOpinionWorker);
    const created = await runtimeService.createIssue({
      title: 'Second opinion issue',
      targetRepo: workspace,
      body: 'The loop should persist a secondary Claude Code review artifact.',
      priority: 'P2',
      acceptanceCriteria: ['- Second opinion report is written to .loops evidence'],
    });

    const detail = await runtimeService.runSecondOpinion(created.issue.id);

    expect(secondOpinionWorker.run).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          issue: expect.objectContaining({ id: created.issue.id }),
        }),
        primary: expect.objectContaining({ reviewer: 'codex' }),
      }),
    );
    expect(detail.secondOpinion).toMatchObject({
      status: 'passed',
      secondary: expect.objectContaining({
        reviewer: 'claude-code',
        status: 'passed',
        evidenceIds: [`${created.issue.id}-second-opinion`],
      }),
    });
    expect(detail.evidenceArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'second-opinion',
          status: 'present',
          summary: expect.stringContaining('second opinion'),
        }),
      ]),
    );
    expect(detail.releaseGate?.checklist.secondOpinionPassed).toBe(true);
  });

  it('records delivery governance and applies release gate policies', async () => {
    const created = await service.createIssue({
      title: 'Govern release controls',
      targetRepo: workspace,
      body: 'The loop should persist delivery governance decisions.',
      priority: 'P1',
      acceptanceCriteria: ['- Delivery governance is visible on the detail payload'],
    });

    await service.governDelivery(created.issue.id, {
      action: 'set-review-gate',
      gateKind: 'code',
      status: 'waived',
      actor: 'human',
      reason: 'Accepted for canary validation.',
    });
    await service.governDelivery(created.issue.id, {
      action: 'set-second-opinion-policy',
      requiredForRelease: true,
      conflictHumanGate: true,
      actor: 'human',
    });
    await service.governDelivery(created.issue.id, {
      action: 'record-release-canary',
      status: 'failed',
      targetUrl: 'https://example.com/canary',
      actor: 'human',
      reason: 'Smoke failed.',
    });
    const detail = await service.governDelivery(created.issue.id, {
      action: 'record-runtime-override',
      scope: 'network',
      actor: 'human',
      reason: 'Allow localhost canary probe.',
      expiresAt: '2026-06-23T10:00:00.000Z',
    });

    expect(detail.deliveryGovernance).toMatchObject({
      reviewGateOverrides: [expect.objectContaining({ gateKind: 'code', status: 'waived' })],
      secondOpinionPolicy: expect.objectContaining({ requiredForRelease: true }),
      releaseCanary: expect.objectContaining({ status: 'failed' }),
      runtimeOverrides: [
        expect.objectContaining({ scope: 'network', reason: 'Allow localhost canary probe.' }),
      ],
    });
    expect(detail.reviewGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'code',
          status: 'waived',
          waiverReason: 'Accepted for canary validation.',
        }),
      ]),
    );
    expect(detail.secondOpinion).toMatchObject({
      requiredForRelease: true,
      status: 'pending',
    });
    expect(detail.releaseGate?.checklist).toMatchObject({
      secondOpinionPassed: false,
      canaryPassed: false,
    });
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

  // ---- 0622 · advance decision-table coverage + max-step guard ----

  it('returns the current detail unchanged when advance is called on a CLOSED issue', async () => {
    const created = await service.createIssue({
      title: 'Closed issue advance',
      targetRepo: workspace,
      body: 'Advancing a closed loop must stay closed.',
      priority: 'P2',
      acceptanceCriteria: ['- closed loop is idempotent under advance'],
    });
    await service.advance(created.issue.id); // generate DRAFT
    const finalized = await service.reviewSpec(created.issue.id, {
      action: 'approve',
      reviewer: 'tester',
    });
    expect(finalized.issue.status).toBe('CLOSED');

    const afterAdvance = await service.advance(created.issue.id);
    expect(afterAdvance.issue.status).toBe('CLOSED');
    expect(afterAdvance.state.phase).toBe('CLOSED');
    expect(afterAdvance.state.finalized).toBe(true);
  });

  it('regenerates a DRAFT spec when advancing a REVISION_REQUESTED spec', async () => {
    const created = await service.createIssue({
      title: 'Revision requested advance',
      targetRepo: workspace,
      body: 'Advancing after a revision request should regenerate the draft.',
      priority: 'P2',
      acceptanceCriteria: ['- advance regenerates draft after revision request'],
    });
    await service.advance(created.issue.id); // DRAFT
    await service.reviewSpec(created.issue.id, {
      action: 'request-revision',
      reviewer: 'tester',
      notes: 'tighten scope',
    });
    const before = await service.getIssue(created.issue.id);
    expect(before.spec?.status).toBe('REVISION_REQUESTED');

    const after = await service.advance(created.issue.id);
    expect(after.spec?.status).toBe('DRAFT');
    expect(after.specHistory?.map((spec) => spec.version)).toEqual(['v1', 'v2']);
    expect(after.specHistory?.[0]?.status).toBe('REVISION_REQUESTED');
    expect(after.specHistory?.[1]?.status).toBe('DRAFT');
  });

  it('resumes a paused issue and then stops at the DRAFT spec human gate', async () => {
    const created = await service.createIssue({
      title: 'Paused issue advance',
      targetRepo: workspace,
      body: 'Advancing a paused loop should resume it first.',
      priority: 'P2',
      acceptanceCriteria: ['- advance resumes a paused loop'],
    });
    await service.advance(created.issue.id); // DRAFT
    await service.intervene(created.issue.id, { action: 'pause', actor: 'tester' });
    const paused = await service.getIssue(created.issue.id);
    expect(paused.state.paused).toBe(true);

    const after = await service.advance(created.issue.id);
    expect(after.state.paused).toBe(false);
    expect(after.spec?.status).toBe('DRAFT');
  });

  it('rejects advance when the spec is in a non-approved, non-closed state', async () => {
    const created = await service.createIssue({
      title: 'Rejected spec advance',
      targetRepo: workspace,
      body: 'A rejected-but-not-closed spec should not be advanceable.',
      priority: 'P2',
      acceptanceCriteria: ['- advance refuses a non-approved spec'],
    });
    const draft = await service.advance(created.issue.id); // DRAFT
    // Force an inconsistent state (REJECTED without CLOSED) to exercise the guard.
    await store.writeSpec(draft.issue, { ...draft.spec, status: 'REJECTED' }, {
      ...draft.state,
      phase: 'PHASE_1_SPEC',
      updated: new Date().toISOString(),
    } as typeof draft.state);

    await expect(service.advance(created.issue.id)).rejects.toThrow(
      /Approved spec is required before advancing loop automation/,
    );
  });

  it('runs global review and finalizes when advancing from PHASE_6_CONVERGE', async () => {
    const created = await service.createIssue({
      title: 'Converge advance',
      targetRepo: workspace,
      body: 'Advancing a converged loop should finalize on PASS.',
      priority: 'P2',
      acceptanceCriteria: ['- advance finalizes a converged loop'],
    });
    const draft = await service.advance(created.issue.id); // DRAFT
    await store.writeSpec(
      draft.issue,
      { ...draft.spec, status: 'APPROVED', approvedBy: 'tester' },
      { ...draft.state, phase: 'PHASE_3_DECOMPOSE', updated: new Date().toISOString() },
    );
    await service.decompose(created.issue.id);
    // Drive the shards to DONE through the real runner so implementation/test/review
    // evidence exists, then advance from PHASE_6_CONVERGE should PASS and finalize.
    let converged = await service.getIssue(created.issue.id);
    while (converged.state.phase !== 'PHASE_6_CONVERGE') {
      converged = await service.runLoop(created.issue.id);
    }
    expect(converged.state.phase).toBe('PHASE_6_CONVERGE');

    const result = await service.advance(created.issue.id);
    expect(result.state.globalVerdict).toBe('PASS');
    expect(result.state.phase).toBe('CLOSED');
    expect(result.state.finalized).toBe(true);
    expect(result.issue.status).toBe('CLOSED');
  });

  it('stops and returns the current detail when the global verdict is not PASS', async () => {
    const created = await service.createIssue({
      title: 'Needs-work advance',
      targetRepo: workspace,
      body: 'A non-PASS global verdict should stop advance without regressing state.',
      priority: 'P2',
      acceptanceCriteria: ['- advance stops on a non-PASS verdict'],
    });
    const draft = await service.advance(created.issue.id); // DRAFT
    await store.writeSpec(
      draft.issue,
      { ...draft.spec, status: 'APPROVED', approvedBy: 'tester' },
      { ...draft.state, phase: 'PHASE_3_DECOMPOSE', updated: new Date().toISOString() },
    );
    await service.decompose(created.issue.id);
    let converged = await service.getIssue(created.issue.id);
    while (converged.state.phase !== 'PHASE_6_CONVERGE') {
      converged = await service.runLoop(created.issue.id);
    }
    // Simulate a recorded NEEDS-WORK verdict and drop back to an execution phase:
    // advance must return without re-running reviewGlobal or regressing state.
    await store.upsertState({
      ...converged.state,
      phase: 'PHASE_4_IMPLEMENT',
      globalVerdict: 'NEEDS-WORK',
      finalized: false,
      updated: new Date().toISOString(),
    });

    const result = await service.advance(created.issue.id);
    expect(result.state.globalVerdict).toBe('NEEDS-WORK');
    expect(result.state.phase).toBe('PHASE_4_IMPLEMENT');
    expect(result.state.finalized).toBe(false);
  });

  it('logs a LOOP_ADVANCE_LIMIT safety event when the engine cannot converge', async () => {
    const created = await service.createIssue({
      title: 'Advance step limit',
      targetRepo: workspace,
      body: 'A non-progressing adapter must trip the advance step guard.',
      priority: 'P2',
      acceptanceCriteria: ['- advance step guard logs LOOP_ADVANCE_LIMIT'],
    });
    const draft = await service.advance(created.issue.id); // DRAFT
    await store.writeSpec(
      draft.issue,
      { ...draft.spec, status: 'APPROVED', approvedBy: 'tester' },
      { ...draft.state, phase: 'PHASE_3_DECOMPOSE', updated: new Date().toISOString() },
    );
    const decomposed = await service.decompose(created.issue.id);
    const frozen = await service.getIssue(created.issue.id);
    expect(decomposed.shards.length).toBeGreaterThan(0);

    // Simulate a broken/looping adapter: runLoop returns without changing state,
    // so advance must exhaust its step budget and log the guard event.
    jest.spyOn(service, 'runLoop').mockResolvedValue(frozen);
    const result = await service.advance(created.issue.id);
    expect(result.state.finalized).not.toBe(true);
    expect(result.issue.status).not.toBe('CLOSED');

    const fresh = await service.getIssue(created.issue.id);
    expect(fresh.logs.some((entry) => entry.type === 'LOOP_ADVANCE_LIMIT')).toBe(true);
  });

  it('maps deterministic natural-language commands to safe loop operations', async () => {
    const created = await service.createIssue({
      title: 'Natural command issue',
      targetRepo: workspace,
      body: 'Natural commands should map to safe deterministic Loops operations.',
      priority: 'P2',
      acceptanceCriteria: ['- natural commands are audited and deterministic'],
    });

    const evidence = await service.naturalCommand(created.issue.id, {
      actor: 'tester',
      command: 'show evidence logs',
    });
    expect(evidence.intent).toBe('query-evidence');
    expect(evidence.executed).toBe(false);
    expect(evidence.logs?.some((entry) => entry.type === 'NATURAL_COMMAND')).toBe(true);

    const unknown = await service.naturalCommand(created.issue.id, {
      actor: 'tester',
      command: 'make it beautiful somehow',
    });
    expect(unknown.intent).toBe('unknown');
    expect(unknown.executed).toBe(false);

    const continued = await service.naturalCommand(created.issue.id, {
      actor: 'tester',
      command: 'continue the loop',
    });
    expect(continued.intent).toBe('continue');
    expect(continued.executed).toBe(true);
    expect(continued.detail?.spec?.status).toBe('DRAFT');
  });
});
