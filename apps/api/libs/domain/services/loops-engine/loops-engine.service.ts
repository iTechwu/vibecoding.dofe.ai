import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import type {
  LoopAnnotation,
  LoopConvergencePr,
  LoopDetail,
  LoopGlobalReviewRecord,
  LoopImplementationRecord,
  LoopIssue,
  LoopLearning,
  LoopReloopResponse,
  LoopReviewShardRequest,
  LoopShard,
  LoopSpec,
  LoopStateItem,
  LoopTestMatrix,
  LoopTestRecord,
} from '@repo/contracts';
import { LoopsFileStoreService, readLoopsRuntimeConfig } from '@app/services/loops-store';
import {
  type LoopsAgentAdapter,
  type LoopsReviewIssue,
  type LoopsReviewOutput,
  type LoopsTestReviewOutput,
} from '@app/services/loops-runners';

/** Human-readable labels for loop phases (used by `formatPhase`). */
const PHASE_LABELS: Record<string, string> = {
  PHASE_0_INTAKE: 'Intake',
  PHASE_1_SPEC: 'Spec',
  PHASE_2_REVIEW: 'Review',
  PHASE_3_DECOMPOSE: 'Decompose',
  PHASE_4_IMPLEMENT: 'Implement',
  PHASE_5_REVIEW: 'Shard Review',
  PHASE_6_CONVERGE: 'Converge',
  PHASE_7_GLOBAL_REVIEW: 'Global Review',
  PHASE_8_ANNOTATE: 'Annotate',
  CLOSED: 'Closed',
  PAUSED: 'Paused',
};

/**
 * Loops Engine domain service — `@app/services/loops-engine`.
 *
 * 结构优化 Step 3 + nextstep Step N1：loop 状态机的「纯状态推导原语」+ spec/decompose
 * 推进流。前者无 DI 依赖；后者经 `store`（spec/shard 写入 + cost guard）与
 * `LoopsAgentAdapter`（plan/decompose/designTests，interface 来自 `loops-runners`，impl
 * 经 `LOOPS_AGENT_ADAPTER` token 注入）执行状态机推进。
 *
 * 当前承接：
 * - 纯推导：`nextResumePhase` / `nextSpecVersion` / `findRunnableShard` / `formatPhase`。
 * - 纯谓词：`isTerminal`。
 * - cost guard：`applyCostGuard`（原 facade `costGuardedState`，依赖 store.enforceCostGuard）。
 * - 推进流：`generateSpec` / `decompose`（自包含 transition，无 advance/runLoop 递归）。
 *
 * facade 仍保留：`reviewSpec`（approve 时调 `advance`）、`advance`/`runLoop`/`finalize`/
 * `reloop`（深度递归 + 多依赖，后续 N1 子批迁移）以及 `getIssue`/`syncAndRead` 的
 * enriched detail 读写（presentation 层）。
 *
 * 依赖方向：`@repo/contracts` + `@app/services/loops-store` + `@app/services/loops-runners`
 *（interface），不 import `src/modules/**`。
 */
@Injectable()
export class LoopsEngineService {
  constructor(
    @Optional()
    private readonly store?: LoopsFileStoreService,
  ) {}

  /** Pick the phase to resume into after an interruption. */
  nextResumePhase(state: LoopStateItem): LoopStateItem['phase'] {
    if (state.shardsTotal > 0) return 'PHASE_4_IMPLEMENT';
    if (state.specVersion === 'v0') return 'PHASE_1_SPEC';
    return 'PHASE_2_REVIEW';
  }

  /** Bump the spec version: `v0` → `v1` → `v2` … */
  nextSpecVersion(current: string): string {
    if (current === 'v0') return 'v1';
    const currentNumber = Number(current.replace('v', ''));
    return `v${Number.isFinite(currentNumber) ? currentNumber + 1 : 1}`;
  }

  /** Find the next shard that is ready to run (deps DONE, status TODO/NEEDS-WORK). */
  findRunnableShard(shards: LoopShard[]): LoopShard | undefined {
    return shards.find(
      (shard) =>
        (shard.status === 'TODO' || shard.status === 'NEEDS-WORK') &&
        shard.dependsOn.every((dependency) =>
          shards.some((candidate) => candidate.id === dependency && candidate.status === 'DONE'),
        ),
    );
  }

  /** Map a phase id to a human-readable label. */
  formatPhase(phase: string): string {
    return PHASE_LABELS[phase] ?? phase.replace('PHASE_', 'P').replaceAll('_', ' ');
  }

  /** True when the loop is in a terminal (closed / finalized) state. */
  isTerminal(detail: LoopDetail): boolean {
    return (
      detail.issue.status === 'CLOSED' ||
      detail.state.phase === 'CLOSED' ||
      detail.state.finalized === true
    );
  }

  /**
   * Apply the cost guard to a state transition: bump call/token counters, then
   * let the store enforce per-loop / workspace cost limits. Mirrors the legacy
   * facade `costGuardedState`.
   */
  async applyCostGuard(
    state: LoopStateItem,
    delta: { calls?: number; tokens?: number } = {},
  ): Promise<LoopStateItem> {
    const calls = delta.calls ?? 1;
    const tokens = delta.tokens ?? 0;
    return this.store!.enforceCostGuard({
      ...state,
      costCalls: state.costCalls + calls,
      costTokens: state.costTokens + tokens,
      updated: new Date().toISOString(),
    });
  }

  /**
   * PHASE_1_SPEC → PHASE_2_REVIEW：plan a spec via the agent adapter and persist
   * it as DRAFT (revision path appends a 修订说明). Mirrors legacy
   * `LoopsService.generateSpec` mutation; the facade owns the enriched read-back.
   */
  async generateSpec(detail: LoopDetail, agentAdapter: LoopsAgentAdapter): Promise<void> {
    if (!this.store) {
      throw new Error('LoopsEngineService requires store for generateSpec');
    }
    if (detail.spec && detail.spec.status !== 'REVISION_REQUESTED') {
      throw new BadRequestException('Spec already exists and is not waiting for revision');
    }

    const now = new Date().toISOString();
    const version = this.nextSpecVersion(detail.state.specVersion);
    const plannedSpec = await agentAdapter.plan(detail.issue, now);
    const spec: LoopSpec = {
      ...plannedSpec,
      id:
        version === 'v1'
          ? plannedSpec.id
          : `spec-${detail.issue.id.replace('issue-', '')}-${version}`,
      version,
      status: 'DRAFT',
      body:
        version === 'v1'
          ? plannedSpec.body
          : `${plannedSpec.body}\n\n## 修订说明\n本版本由 ${detail.state.specVersion} 修订生成，等待人工重新审核。\n`,
    };
    const state: LoopStateItem = {
      ...detail.state,
      phase: 'PHASE_2_REVIEW',
      specVersion: version,
      updated: now,
    };

    await this.store.writeSpec(detail.issue, spec, await this.applyCostGuard(state));
  }

  /**
   * PHASE_3_DECOMPOSE → PHASE_4_IMPLEMENT：decompose the approved spec into shards
   * + test matrix via the agent adapter and persist. Returns `true` when a
   * decomposition was written, `false` for terminal / already-decomposed no-ops.
   * Mirrors legacy `LoopsService.decompose` mutation.
   */
  async decompose(detail: LoopDetail, agentAdapter: LoopsAgentAdapter): Promise<boolean> {
    if (!this.store) {
      throw new Error('LoopsEngineService requires store for decompose');
    }
    if (this.isTerminal(detail)) return false;
    if (detail.shards.length > 0) return false;
    if (!detail.spec || detail.spec.status !== 'APPROVED') {
      throw new BadRequestException('Approved spec is required before decompose');
    }

    const now = new Date().toISOString();
    const { shards, annotations } = await agentAdapter.decompose(detail.issue, detail.spec);
    const testMatrix = await agentAdapter.designTests(detail.issue, detail.spec, shards, now);
    const state: LoopStateItem = {
      ...detail.state,
      phase: 'PHASE_4_IMPLEMENT',
      shardsTotal: shards.length,
      shardsDone: 0,
      shardsInProgress: 0,
      updated: now,
    };

    await this.store.writeShards({
      issue: detail.issue,
      spec: detail.spec,
      shards,
      testMatrix,
      annotations,
      state: await this.applyCostGuard(state),
    });
    return true;
  }

  /**
   * Resume a paused loop: clear `paused`, demote PAUSED phase back to
   * PHASE_4_IMPLEMENT, and emit a `LOOP_INTERVENTION` log. Only the state
   * mutation lives here (原 facade `resumeAndRead` 前半段); the enriched
   * read-back stays facade-side (`syncAndRead`).
   */
  async applyResume(issueId: string, detail: LoopDetail): Promise<void> {
    if (!this.store) {
      throw new Error('LoopsEngineService requires store for applyResume');
    }
    const now = new Date().toISOString();
    await this.store.upsertState({
      ...detail.state,
      paused: false,
      phase: detail.state.phase === 'PAUSED' ? 'PHASE_4_IMPLEMENT' : detail.state.phase,
      updated: now,
    });
    await this.store.appendLog({
      type: 'LOOP_INTERVENTION',
      issue: issueId,
      action: 'resume',
      actor: 'loops-engine',
    });
  }

  /**
   * 自动回环（原 facade `reloop`）：max-reloop 校验 → 下一轮 spec 版本 + reloop 计数 →
   * 写 DRAFT reloop spec + PHASE_2_REVIEW state。返回 `LoopReloopResponse`（不含 detail，
   * 无需 enriched read-back）。spec 构造（`buildReloopSpec`）为纯函数，一并下沉。
   */
  async reloop(
    issueId: string,
    detail: LoopDetail,
    request: { reviewer?: string; notes?: string },
  ): Promise<LoopReloopResponse> {
    if (!this.store) {
      throw new Error('LoopsEngineService requires store for reloop');
    }
    const maxReloop = (await readLoopsRuntimeConfig()).maxReloop;
    if ((detail.state.reloopCount ?? 0) >= maxReloop) {
      throw new BadRequestException('Max re-loop count reached');
    }

    const now = new Date().toISOString();
    const nextRound = detail.state.round + 1;
    const reloopCount = detail.state.reloopCount + 1;
    const specVersion = this.nextSpecVersion(detail.state.specVersion);
    const spec = this.buildReloopSpec({
      detail,
      specVersion,
      now,
      reviewer: request.reviewer ?? 'human',
      notes: `notes: ${request.notes ?? '整体复查后进入下一轮修订。'}`,
    });
    const state: LoopStateItem = {
      ...detail.state,
      phase: 'PHASE_2_REVIEW',
      round: nextRound,
      specVersion,
      shardsTotal: 0,
      shardsDone: 0,
      shardsInProgress: 0,
      reloopCount,
      globalVerdict: undefined,
      finalized: false,
      updated: now,
    };

    await this.store.writeSpec(detail.issue, spec, state);
    return {
      issueId,
      specVersion,
      round: nextRound,
      reloopCount,
      maxReloop,
      phase: state.phase,
      paused: state.paused,
    };
  }

  /** Build the DRAFT reloop spec (pure; original facade `buildReloopSpec`). */
  buildReloopSpec(input: {
    detail: LoopDetail;
    specVersion: string;
    now: string;
    reviewer: string;
    notes: string;
  }): LoopSpec {
    const baseBody = input.detail.spec?.body ?? input.detail.issue.body;
    return {
      id: `spec-${input.detail.issue.id.replace('issue-', '')}-${input.specVersion}`,
      issueId: input.detail.issue.id,
      version: input.specVersion,
      status: 'DRAFT',
      created: input.now,
      contextBudget: input.detail.spec?.contextBudget ?? 24000,
      body: `${baseBody}\n\n## 自动回环修订 ${input.specVersion}\nreviewer: ${input.reviewer}\n${input.notes}\n`,
    };
  }

  /**
   * 终态收敛（原 facade `finalize`）：globalVerdict PASS 校验 → release-gate 硬门禁 →
   * 开收敛 PR（commit 各 shard）→ annotateFinalize → learnings → writeFinalize（CLOSED/
   * finalized）→ PR 评论发布。编排顺序与状态写入在 domain；release-gate / git adapter /
   * evidence-artifacts / agent annotate / learnings / PR 评论等 builder 经
   * `LoopsEngineFinalizePort` 注入（最大依赖面），避免 domain 拖入 evidence/git/PR 实现。
   */
  async finalize(issueId: string, port: LoopsEngineFinalizePort): Promise<LoopDetail> {
    if (!this.store) {
      throw new Error('LoopsEngineService requires store for finalize');
    }
    const detail = await port.getDetail(issueId);
    if (this.isTerminal(detail)) {
      return detail;
    }
    if (detail.state.globalVerdict !== 'PASS') {
      throw new BadRequestException('Global review PASS is required before finalize');
    }
    // gstack/0 P0-2: Release Gate hard blocking — enforce checklist before proceeding.
    port.enforceReleaseGateOrThrow(detail);
    const now = new Date().toISOString();
    const convergencePr = await port.openConvergencePr(detail);
    const annotations = await port.annotateFinalize(detail, convergencePr);
    const learnings = port.buildLearnings(detail, convergencePr, now);
    await this.store.writeFinalize({
      issue: detail.issue,
      annotations,
      convergencePr,
      learnings,
      state: {
        ...detail.state,
        phase: 'CLOSED',
        finalized: true,
        updated: now,
      },
    });
    await port.publishPrComment(issueId, convergencePr);
    return port.readDetail(issueId);
  }

  /**
   * PHASE_6_CONVERGE → 整体复查（原 facade `reviewGlobal`）：三分支决策——
   * (1) 当前 round 证据不完整 → NEEDS-WORK；(2) 全局回归失败 → NEEDS-WORK；
   * (3) agent reviewGlobal → PASS（→ PHASE_8_ANNOTATE）/ 非 PASS（→ autoReloop）。
   * record 构造 + 状态写入 + annotation 映射在 domain；证据收集 / 回归 / agent review /
   * autoReloop / enriched read-back 经 `LoopsEngineGlobalReviewPort` 注入。行为与 legacy 一致。
   */
  async reviewGlobal(issueId: string, port: LoopsEngineGlobalReviewPort): Promise<LoopDetail> {
    if (!this.store) {
      throw new Error('LoopsEngineService requires store for reviewGlobal');
    }
    const detail = await port.getDetail(issueId);
    if (this.isTerminal(detail)) {
      return detail;
    }

    // (1) current-round evidence completeness gate
    const evidenceIssues = await port.collectEvidenceIssues(detail);
    if (evidenceIssues.length > 0) {
      const now = new Date().toISOString();
      const record: LoopGlobalReviewRecord = {
        id: `global-review-${issueId}-r${detail.state.round}-${Date.now()}`,
        issueId,
        reviewer: 'system',
        round: detail.state.round,
        verdict: 'NEEDS-WORK',
        issues: evidenceIssues,
        fixInstructions: ['补齐当前 round 的 implementation/test/review 证据后重新整体复查。'],
        summary: 'Global review blocked: current-round evidence is incomplete.',
        created: now,
      };
      await this.store.writeGlobalReview({
        issueId,
        record,
        annotations: detail.annotations,
        state: {
          ...detail.state,
          phase: 'PHASE_4_IMPLEMENT',
          globalVerdict: 'NEEDS-WORK',
          updated: now,
        },
      });
      return port.readDetail(issueId);
    }

    // (2) global regression gate
    const regression = await port.runRegression(detail);
    if (regression.status !== 'TEST-PASS') {
      const now = new Date().toISOString();
      const record: LoopGlobalReviewRecord = {
        id: `global-review-${issueId}-r${detail.state.round}-${Date.now()}`,
        issueId,
        reviewer: 'system',
        round: detail.state.round,
        verdict: 'NEEDS-WORK',
        issues: regression.failedTests.map((item) => ({
          severity: 'major' as const,
          desc: `Global regression failed: ${item.name}: ${item.reason}`,
        })),
        fixInstructions:
          regression.fixInstructions.length > 0
            ? regression.fixInstructions
            : ['修复全局回归失败后重新执行整体复查。'],
        summary: 'Global review blocked: regression tests failed.',
        created: now,
      };
      await this.store.writeGlobalReview({
        issueId,
        record,
        annotations: detail.annotations,
        state: {
          ...detail.state,
          phase: 'PHASE_4_IMPLEMENT',
          globalVerdict: 'NEEDS-WORK',
          updated: now,
        },
      });
      return port.readDetail(issueId);
    }

    // (3) agent global review
    const { review, reviewDetail } = await port.runAgentGlobalReview(detail);
    const now = new Date().toISOString();
    const record: LoopGlobalReviewRecord = {
      id: `global-review-${issueId}-r${detail.state.round}-${Date.now()}`,
      issueId,
      reviewer: 'codex',
      round: detail.state.round,
      verdict: review.verdict,
      issues: review.issues,
      fixInstructions: review.fixInstructions,
      summary: review.summary,
      created: now,
    };
    const nextAnnotations = reviewDetail.annotations.map((annotation) =>
      annotation.target === issueId
        ? {
            ...annotation,
            annotator: 'codex' as const,
            verdict:
              review.verdict === 'PASS'
                ? ('pass' as const)
                : review.verdict === 'FAIL'
                  ? ('fail' as const)
                  : ('needs-work' as const),
            notes: `整体复查 ${review.verdict}：${review.summary}`,
          }
        : annotation,
    );
    if (review.verdict !== 'PASS') {
      return port.autoReloop({
        issueId,
        detail: reviewDetail,
        record,
        annotations: nextAnnotations,
        now,
      });
    }

    await this.store.writeGlobalReview({
      issueId,
      record,
      annotations: nextAnnotations,
      state: {
        ...reviewDetail.state,
        phase: 'PHASE_8_ANNOTATE',
        globalVerdict: review.verdict,
        updated: now,
      },
    });
    return port.readDetail(issueId);
  }

  /**
   * Run the PHASE_4 loop inside the issue/repo work lock (original facade
   * `runLoop`). The lock backend stays behind a narrow port so the engine owns
   * the terminal guard + lock boundary without importing lock implementations.
   */
  async runLoop(issueId: string, port: LoopsEngineRunLoopPort): Promise<LoopDetail> {
    const detail = await port.getDetail(issueId);
    if (this.isTerminal(detail)) {
      return detail;
    }
    return port.withIssueAndRepoLock({ issueId, targetRepo: detail.issue.targetRepo }, () =>
      this.runLoopUnlocked(issueId, detail, port.shardRunnerPort),
    );
  }

  /**
   * PHASE_4_IMPLEMENT shard 调度（原 facade `runLoopUnlocked`）：在 context budget /
   * maxParallel 约束下挑选可执行 shard，经 port 执行，并处理 interrupted 恢复、
   * context-budget 阻塞、全部 DONE → PHASE_6_CONVERGE 收敛。store 编排（recover /
   * block / upsertState / appendLog）全部在 domain；重执行（`runRunnableShard`：
   * agentAdapter + persist + runShardTests + reviewShard）与 enriched read-back
   *（`readFreshDetail` = facade `syncAndRead`）经 `LoopsEngineShardRunnerPort` 注入。
   * 行为与 legacy `LoopsService.runLoopUnlocked` 完全一致。
   */
  async runLoopUnlocked(
    issueId: string,
    detail: LoopDetail,
    port: LoopsEngineShardRunnerPort,
  ): Promise<LoopDetail> {
    if (!this.store) {
      throw new Error('LoopsEngineService requires store for runLoopUnlocked');
    }
    if (detail.state.paused) {
      throw new BadRequestException('Paused loop cannot be advanced');
    }
    if (!detail.spec || detail.spec.status !== 'APPROVED') {
      throw new BadRequestException('Approved spec is required before running loop');
    }

    const { contextBudget, maxParallel } = await readLoopsRuntimeConfig();
    let currentDetail = detail;
    let advanced = 0;
    let blocked = 0;
    let recovered = 0;

    while (advanced < maxParallel) {
      let shard = this.findRunnableShard(currentDetail.shards);
      if (!shard) {
        const recoveredShards = await this.recoverInterruptedShards(issueId, currentDetail);
        if (recoveredShards) {
          recovered += 1;
          currentDetail = await port.readFreshDetail(issueId);
          shard = this.findRunnableShard(currentDetail.shards);
        }
      }
      if (!shard) {
        break;
      }
      if (shard.estContext >= contextBudget) {
        await this.blockShardForContextBudget(issueId, currentDetail, shard, contextBudget);
        blocked += 1;
        currentDetail = await port.readFreshDetail(issueId);
        continue;
      }
      await this.runRunnableShard(issueId, currentDetail, shard, port);
      advanced += 1;
      currentDetail = await port.readFreshDetail(issueId);
      if (currentDetail.state.paused) {
        break;
      }
    }

    if (advanced > 0) {
      await this.store.appendLog({
        type: 'SCHEDULER_BATCH',
        loop: issueId,
        max_parallel: maxParallel,
        context_budget: contextBudget,
        advanced,
        blocked,
        recovered,
      });
      return port.readFreshDetail(issueId);
    }

    if (blocked > 0 || recovered > 0) {
      await this.store.appendLog({
        type: 'SCHEDULER_BATCH',
        loop: issueId,
        max_parallel: maxParallel,
        context_budget: contextBudget,
        advanced,
        blocked,
        recovered,
      });
      return port.readFreshDetail(issueId);
    }

    // Convergence must be judged against the freshest shard snapshot
    // (`currentDetail`, updated inside the loop above), not the stale
    // `detail` captured before the first advancement.
    if (
      currentDetail.shards.length > 0 &&
      currentDetail.shards.every((item) => item.status === 'DONE')
    ) {
      const now = new Date().toISOString();
      await this.store.upsertState({
        ...currentDetail.state,
        phase: 'PHASE_6_CONVERGE',
        shardsDone: currentDetail.shards.length,
        shardsInProgress: 0,
        updated: now,
      });
      return port.readFreshDetail(issueId);
    }
    throw new BadRequestException('No runnable shard is available');
  }

  /**
   * Execute a single runnable shard（原 facade `runRunnableShard`）：mark IN_PROGRESS →
   * agent implement（claude adapter）→ persist implementation record → run tests →
   * review-tests → review → derive verdict（TEST-PASS 取 review.verdict，否则 NEEDS-WORK）
   * → apply review。IN_PROGRESS 状态写入与 verdict 推导在 domain；agent/persist/runner/
   * review 实现（最大依赖面）经 `LoopsEngineShardRunnerPort` 注入。行为与 legacy 一致。
   */
  async runRunnableShard(
    issueId: string,
    detail: LoopDetail,
    shard: LoopShard,
    port: LoopsEngineShardRunnerPort,
  ): Promise<void> {
    if (!this.store) {
      throw new Error('LoopsEngineService requires store for runRunnableShard');
    }
    const started = new Date().toISOString();
    const inProgressShards = detail.shards.map((item) =>
      item.id === shard.id ? { ...item, status: 'IN_PROGRESS' as const } : item,
    );
    await this.store.writeShardProgress({
      issueId,
      from: shard.status,
      to: 'IN_PROGRESS',
      actor: 'loops-scheduler',
      shardId: shard.id,
      state: {
        ...detail.state,
        phase: 'PHASE_4_IMPLEMENT',
        shardsInProgress: 1,
        updated: started,
      },
      shards: inProgressShards,
    });

    const record = await port.runAgent({
      issue: detail.issue,
      shard,
      round: detail.state.round,
      cwd: detail.issue.targetRepo,
    });
    const implementationDetail = await port.persistImplementation(issueId, shard.id, record);
    const testRecord = await port.runTests(issueId, shard.id);
    const testReview = await port.reviewTests({
      matrix: implementationDetail.testMatrix,
      testRecord,
    });
    const review = await port.review({
      shard,
      implementationRecord: record,
      testRecord,
    });

    const verdict =
      testReview.testVerdict === 'TEST-PASS' ? review.verdict : ('NEEDS-WORK' as const);
    await port.applyReview(issueId, shard.id, {
      reviewer: 'codex',
      verdict,
      summary:
        verdict === review.verdict ? review.summary : `测试复核未通过：${testReview.summary}`,
      issues: verdict === review.verdict ? review.issues : testReview.issues,
      fixInstructions:
        verdict === review.verdict ? review.fixInstructions : testReview.fixInstructions,
    });
  }

  /**
   * Requeue IN_PROGRESS / TIMEOUT shards as TODO (original
   * `recoverInterruptedShards`). Returns true when any shard was recovered so
   * the caller can re-read fresh detail before retrying `findRunnableShard`.
   */
  private async recoverInterruptedShards(issueId: string, detail: LoopDetail): Promise<boolean> {
    const interrupted = detail.shards.filter((shard) =>
      ['IN_PROGRESS', 'TIMEOUT'].includes(shard.status),
    );
    if (interrupted.length === 0) return false;

    const now = new Date().toISOString();
    const nextShards = detail.shards.map((shard) =>
      interrupted.some((item) => item.id === shard.id)
        ? { ...shard, status: 'TODO' as const }
        : shard,
    );
    await this.store!.writeShardProgress({
      issueId,
      shardId: interrupted.map((shard) => shard.id).join(','),
      from: 'INTERRUPTED',
      to: 'TODO',
      actor: 'loops-scheduler',
      shards: nextShards,
      state: {
        ...detail.state,
        phase: 'PHASE_4_IMPLEMENT',
        shardsInProgress: 0,
        paused: false,
        updated: now,
      },
    });
    await this.store!.appendLog({
      type: 'SCHEDULER_RECOVERED_INTERRUPTED_SHARDS',
      loop: issueId,
      shards: interrupted.map((shard) => shard.id),
    });
    return true;
  }

  /** Block a shard whose estContext exceeds the context budget (original `blockShardForContextBudget`). */
  private async blockShardForContextBudget(
    issueId: string,
    detail: LoopDetail,
    shard: LoopShard,
    contextBudget: number,
  ): Promise<void> {
    const now = new Date().toISOString();
    const nextShards = detail.shards.map((item) =>
      item.id === shard.id ? { ...item, status: 'BLOCKED' as const } : item,
    );
    const nextAnnotations = detail.annotations.map((annotation) =>
      annotation.target === shard.id
        ? {
            ...annotation,
            implStatus: 'skipped' as const,
            testStatus: 'skipped' as const,
            verdict: 'needs-work' as const,
            coverage: 'none' as const,
            risk: 'high' as const,
            notes: `Shard est_context=${shard.estContext} exceeds context_budget=${contextBudget}; re-decompose before implementation.`,
          }
        : annotation,
    );
    await this.store!.writeShardProgress({
      issueId,
      from: shard.status,
      to: 'BLOCKED',
      actor: 'loops-scheduler',
      shardId: shard.id,
      state: {
        ...detail.state,
        phase: 'PHASE_4_IMPLEMENT',
        shardsInProgress: 0,
        updated: now,
      },
      shards: nextShards,
      annotations: nextAnnotations,
    });
    await this.store!.appendLog({
      type: 'CONTEXT_BUDGET_EXCEEDED',
      loop: issueId,
      shard: shard.id,
      est_context: shard.estContext,
      context_budget: contextBudget,
      status: 'BLOCKED',
    });
    await this.store!.writeNotification({
      issueId,
      channel: 'web',
      kind: 'CONTEXT_BUDGET_EXCEEDED',
      recipient: 'human',
      title: `Shard blocked by context budget: ${shard.id}`,
      body: `Shard ${shard.id} est_context=${shard.estContext} exceeds context_budget=${contextBudget}. Re-decompose before implementation.`,
      actionHref: `/loops/${issueId}`,
    });
  }

  /**
   * PHASE dispatcher（原 facade `advance`）：根据当前 detail 状态决定下一个推进动作，
   * 循环直到到达终态 / 需要人工介入 / 达到步数上限。所有 transition 实现经
   * `LoopsEngineAdvancePort` 注入（spec/decompose 已在 engine，finalize/reviewGlobal/
   * runLoop/resume 仍属 facade），从而把递归调度逻辑下沉到 domain 而不引入
   * engine↔facade 类环依赖。行为与 legacy `LoopsService.advance` 完全一致。
   */
  async advance(issueId: string, port: LoopsEngineAdvancePort): Promise<LoopDetail> {
    let detail = await port.getDetail(issueId);
    const maxSteps = Math.max(detail.shards.length + 8, 12);

    for (let step = 0; step < maxSteps; step += 1) {
      if (detail.state.paused) {
        detail = await port.resumeAndRead(issueId, detail);
        continue;
      }
      if (detail.issue.status === 'CLOSED' || detail.state.phase === 'CLOSED') {
        return detail;
      }
      if (!detail.spec || detail.spec.status === 'REVISION_REQUESTED') {
        return port.generateSpec(issueId);
      }
      if (detail.spec.status === 'DRAFT') {
        return detail;
      }
      if (detail.spec.status !== 'APPROVED') {
        throw new BadRequestException('Approved spec is required before advancing loop automation');
      }
      if (detail.shards.length === 0 || detail.state.phase === 'PHASE_3_DECOMPOSE') {
        detail = await port.decompose(issueId);
        continue;
      }
      if (detail.state.globalVerdict === 'PASS' && !detail.state.finalized) {
        detail = await port.finalize(issueId);
        continue;
      }
      if (detail.state.phase === 'PHASE_6_CONVERGE') {
        detail = await port.reviewGlobal(issueId);
        continue;
      }
      if (detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS') {
        return detail;
      }
      detail = await port.runLoop(issueId);
    }

    await port.appendAdvanceLimitLog(issueId, detail.state.phase, maxSteps);
    return detail;
  }
}

/**
 * Transition-provider port for the engine `advance` dispatcher. The facade
 * supplies each transition (spec/decompose delegate back to the engine;
 * finalize/reviewGlobal/runLoop/resume stay facade-side), so the recursive
 * dispatch logic can live in the domain without a class-level engine↔facade cycle.
 */
export interface LoopsEngineAdvancePort {
  getDetail(issueId: string): Promise<LoopDetail>;
  resumeAndRead(issueId: string, detail: LoopDetail): Promise<LoopDetail>;
  generateSpec(issueId: string): Promise<LoopDetail>;
  decompose(issueId: string): Promise<LoopDetail>;
  finalize(issueId: string): Promise<LoopDetail>;
  reviewGlobal(issueId: string): Promise<LoopDetail>;
  runLoop(issueId: string): Promise<LoopDetail>;
  appendAdvanceLimitLog(issueId: string, phase: string, maxSteps: number): Promise<void>;
}

/**
 * Run-loop lock port. The facade/API layer supplies lock acquisition while the
 * engine owns the terminal guard and delegates the locked body to
 * `runLoopUnlocked`.
 */
export interface LoopsEngineRunLoopPort {
  getDetail(issueId: string): Promise<LoopDetail>;
  withIssueAndRepoLock(
    input: { issueId: string; targetRepo: string },
    run: () => Promise<LoopDetail>,
  ): Promise<LoopDetail>;
  shardRunnerPort: LoopsEngineShardRunnerPort;
}

/**
 * Shard-execution port for the engine `runLoopUnlocked` scheduler + the engine's
 * own `runRunnableShard` pipeline. The facade supplies the heavy per-shard steps
 * (claude adapter implement, persist implementation record, run tests, agent
 * review-tests / review, apply review verdict) and the enriched fresh-detail
 * read (`readFreshDetail` = `syncAndRead`), so the full implement→test→review→
 * verdict pipeline can live in the domain without dragging the
 * agent/persistence/runner/evidence surface into the engine.
 */
export interface LoopsEngineShardRunnerPort {
  readFreshDetail(issueId: string): Promise<LoopDetail>;
  runAgent(input: {
    issue: LoopIssue;
    shard: LoopShard;
    round: number;
    cwd: string;
  }): Promise<LoopImplementationRecord>;
  persistImplementation(
    issueId: string,
    shardId: string,
    record: LoopImplementationRecord,
  ): Promise<LoopDetail>;
  runTests(issueId: string, shardId: string): Promise<LoopTestRecord>;
  reviewTests(input: {
    matrix?: LoopTestMatrix;
    testRecord?: LoopTestRecord;
  }): Promise<LoopsTestReviewOutput>;
  review(input: {
    shard: LoopShard;
    implementationRecord: LoopImplementationRecord;
    testRecord?: LoopTestRecord;
  }): Promise<LoopsReviewOutput>;
  applyReview(issueId: string, shardId: string, request: LoopReviewShardRequest): Promise<void>;
}

/**
 * Finalization port for the engine `finalize`收敛态. The facade supplies the
 * release-gate enforcement, convergence-PR creation (commit loop + git adapter +
 * evidence artifacts), agent annotate, learnings builder, and best-effort PR
 * comment — the heaviest dependency surface — so the finalize ordering + state
 * write can live in the domain.
 */
export interface LoopsEngineFinalizePort {
  getDetail(issueId: string): Promise<LoopDetail>;
  enforceReleaseGateOrThrow(detail: LoopDetail): void;
  openConvergencePr(detail: LoopDetail): Promise<LoopConvergencePr>;
  annotateFinalize(detail: LoopDetail, convergencePr: LoopConvergencePr): Promise<LoopAnnotation[]>;
  buildLearnings(detail: LoopDetail, convergencePr: LoopConvergencePr, now: string): LoopLearning[];
  publishPrComment(issueId: string, convergencePr: LoopConvergencePr): Promise<void>;
  readDetail(issueId: string): Promise<LoopDetail>;
}

/**
 * Global-review port for the engine `reviewGlobal` 整体复查. The facade supplies
 * the current-round evidence-completeness check (requirements coverage fallback),
 * the global regression run (runner + runtime config), the agent reviewGlobal
 * (with enriched re-read), the auto-reloop sub-flow, and the enriched read-back —
 * so the 3-branch decision + record/state writes can live in the domain.
 */
export interface LoopsEngineGlobalReviewPort {
  getDetail(issueId: string): Promise<LoopDetail>;
  collectEvidenceIssues(detail: LoopDetail): Promise<LoopsReviewIssue[]>;
  runRegression(detail: LoopDetail): Promise<{
    status: string;
    failedTests: Array<{ name: string; reason: string }>;
    fixInstructions: string[];
  }>;
  runAgentGlobalReview(
    detail: LoopDetail,
  ): Promise<{ review: LoopsReviewOutput; reviewDetail: LoopDetail }>;
  autoReloop(input: {
    issueId: string;
    detail: LoopDetail;
    record: LoopGlobalReviewRecord;
    annotations: LoopAnnotation[];
    now: string;
  }): Promise<LoopDetail>;
  readDetail(issueId: string): Promise<LoopDetail>;
}
