import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AuthUserInfo } from '@app/auth/types/auth.interface';
import type {
  CreateLoopIssueRequest,
  CreateLoopIssueSimpleRequest,
  LoopDetail,
  LoopIntake,
  LoopIssue,
  LoopIssuesQuery,
  LoopListResponse,
  LoopRuleSnapshot,
  LoopStateItem,
  LoopSubmitter,
  LoopWorkflowRecipe,
} from '@repo/contracts';
import {
  LOOPS_PERSISTENCE,
  LoopsFileStoreService,
  LoopsPersistenceService,
  resolveAllowedTargetRepo,
} from '@app/services/loops-store';
import { LoopsWorkspaceProfileService } from '@app/services/loops-runtime';
import { LoopsEvidenceService } from '@app/services/loops-evidence';

/**
 * Loops Issues domain service — `@app/services/loops-issues`.
 *
 * 结构优化 Step 2：把 issue intake 的「记录构造原语」从 8000 行 `LoopsService` 下沉。
 *
 * 当前承接（本批）：
 * - `createIssueId`：issue id 生成（纯）。
 * - `normalizeSubmitter`：submitter 归一化（SSO 优先，纯）。
 * - `resolveTargetRepo`：目标仓库解析 + 路径策略校验（依赖 store util）。
 * - `writeIssueRecord`：issue/intake/state 双写编排（`.loops` + DB persistence）。
 *
 * `LoopsService.createIssue` 保留编排与 workflow recipe 派生（依赖 evidence/delivery
 * builder，属 Step 5），把上述原语委托给本 service。
 *
 * 待后续 Step 补齐：
 * - `list` / `getIssue` 的完整抽取依赖 delivery/coverage enricher（Step 5 evidence/quality）。
 * - `captureRuleSnapshot` / `resolveSimpleTargetRepo` 依赖 `LoopsWorkspaceProfileService`
 *   （Step 4 loops-runtime），届时 workspaceProfile 下沉后可把其类型从 domain 引入并迁入。
 *
 * 依赖方向：仅依赖 `@app/services/loops-store`（store + persistence）+ `@repo/contracts` +
 * `@app/auth`，不 import `src/modules/**`。
 */
@Injectable()
export class LoopsIssuesService {
  constructor(
    private readonly store: LoopsFileStoreService,
    @Optional()
    @Inject(LOOPS_PERSISTENCE)
    private readonly persistence?: LoopsPersistenceService,
    // 结构优化 Loop 9：workspaceProfile 已下沉到 loops-runtime，可注入；
    // standalone 消费者（无 Nest DI）由 LoopsService 自构造时传入。
    @Optional()
    private readonly workspaceProfile?: LoopsWorkspaceProfileService,
    // 结构优化 nextstep Step N3：issue intake 完整编排（含 workflow recipe 派生）
    // 下沉到本 service；evidence 提供 inferWorkflowKind / buildWorkflowRecipe。
    // standalone 消费者由 LoopsService 自构造时传入。
    @Optional()
    private readonly evidence?: LoopsEvidenceService,
  ) {}

  /**
   * Cryptographic issue id: `issue-YYYYMMDD-<8 hex>`. The 8-hex suffix (32 bits)
   * scoped per day avoids the birthday-bound collision risk of the previous
   * `Math.random()` 6-char base36 suffix.
   */
  createIssueId(now: string): string {
    const date = now.slice(0, 10).replace(/-/g, '');
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
    return `issue-${date}-${suffix}`;
  }

  /**
   * 结构优化 nextstep Step N3：完整 issue intake 编排（原 `LoopsService.createIssue`）。
   *
   * 组装 issue / intake / state 记录，派生 workflow recipe（应用 workspace defaults），
   * 经 `writeIssueRecord` 双写 `.loops` + DB persistence。返回值结构兼容
   * `LoopsIssueCreationPort.createIssue`（`{ issue: { id } }`），故 trigger fire 等可经
   * port 直接消费本 service，不再依赖 legacy facade。
   */
  async createIssue(
    input: CreateLoopIssueRequest,
    authUser?: AuthUserInfo,
  ): Promise<{
    issue: LoopIssue;
    intake: LoopIntake;
    state: LoopStateItem;
  }> {
    if (!this.evidence) {
      throw new Error('LoopsEvidenceService is required for createIssue orchestration');
    }
    const now = new Date().toISOString();
    const issueId = this.createIssueId(now);
    const intakeId = this.store.intakeId(issueId);
    const rawPayloadRef = `.loops/intakes/${intakeId}.raw.json`;
    const targetRepo = await this.resolveTargetRepo(input.targetRepo);
    const submitter = this.normalizeSubmitter(input, authUser);
    const sourceChannel = input.sourceChannel ?? 'web';
    const sourceKind = input.sourceKind ?? 'web_form';
    const issue: LoopIssue = {
      id: issueId,
      title: input.title,
      status: 'OPEN',
      priority: input.priority,
      created: now,
      updated: now,
      sourceChannel,
      sourceKind,
      submitterId: submitter.userId,
      submitterName: submitter.name,
      targetRepo,
      body: input.body,
      acceptanceCriteria: input.acceptanceCriteria,
      rawPayloadRef,
    };
    const ruleSnapshot = await this.captureRuleSnapshot(targetRepo, now);
    const intake: LoopIntake = {
      id: intakeId,
      issueId,
      sourceChannel,
      sourceKind,
      submitter,
      rawPayloadRef,
      status: 'NORMALIZED' as const,
      created: now,
      ruleSnapshot,
    };
    const state: LoopStateItem = {
      issueId,
      phase: 'PHASE_1_SPEC',
      round: 1,
      specVersion: 'v0',
      shardsTotal: 0,
      shardsDone: 0,
      shardsInProgress: 0,
      reloopCount: 0,
      costTokens: 0,
      costCalls: 0,
      updated: now,
      paused: false,
    };
    // gstack/0 P2-6: Apply workspace-level workflow defaults on create.
    const workflowDefaults = await this.store.readWorkflowDefaults();
    const loopKind = this.evidence.inferWorkflowKind({ issue });
    const matchingDefault = workflowDefaults.find((entry) => entry.loopKind === loopKind);
    const workflowRecipe: LoopWorkflowRecipe = {
      ...this.evidence.buildWorkflowRecipe({ issue, state }),
      ...(matchingDefault ? { id: matchingDefault.recipeId } : {}),
      capturedAt: now,
      source: matchingDefault ? ('workspace' as const) : ('loop-snapshot' as const),
    };

    await this.writeIssueRecord({ issue, intake, state, rawPayload: input, workflowRecipe });
    return { issue, intake, state };
  }

  /**
   * Normalise the submitter. Authenticated HTTP path: the SSO user (set by
   * AuthGuard) is the source of truth — client-supplied submitter fields are
   * ignored to prevent spoofing. CLI/internal/unauthenticated path falls back
   * to request-provided or deterministic dev defaults.
   */
  normalizeSubmitter(input: CreateLoopIssueRequest, authUser?: AuthUserInfo): LoopSubmitter {
    if (authUser) {
      return {
        provider: 'dofe-sso',
        userId: authUser.id,
        name: authUser.nickname ?? authUser.code ?? authUser.id,
      };
    }
    return {
      provider: input.submitter?.provider ?? 'dev',
      userId: input.submitter?.userId ?? input.submitterId ?? 'dev-user',
      name: input.submitter?.name ?? input.submitterName ?? 'Developer',
    };
  }

  /** Resolve + validate the target repo against the loops path policy. */
  async resolveTargetRepo(input: string): Promise<string> {
    try {
      return await resolveAllowedTargetRepo(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid targetRepo';
      throw new BadRequestException(message);
    }
  }

  /**
   * Persist the issue record. DB-backed persistence (when wired by the Nest
   * module) wins; otherwise the `.loops` file store is the source of truth.
   */
  async writeIssueRecord(input: {
    issue: LoopIssue;
    intake: LoopIntake;
    state: LoopStateItem;
    rawPayload: unknown;
    workflowRecipe?: LoopWorkflowRecipe;
  }): Promise<void> {
    if (this.persistence) {
      await this.persistence.writeIssue(input);
      return;
    }
    await this.store.writeIssue(input);
  }

  /**
   * Resolve the target repo for a simple (one-sentence) issue. Honours an
   * explicit targetRepo; otherwise resolves from the workspace profile; falls
   * back to the path-policy repo root for standalone consumers.
   */
  async resolveSimpleTargetRepo(input: CreateLoopIssueSimpleRequest): Promise<string> {
    if (input.targetRepo && input.targetRepo.trim().length > 0) {
      return this.resolveTargetRepo(input.targetRepo);
    }
    if (this.workspaceProfile) {
      const workspace = await this.workspaceProfile.resolve(input.workspaceId);
      return this.resolveTargetRepo(workspace.root);
    }
    return this.resolveTargetRepo('.');
  }

  /**
   * Capture a snapshot of agent-readable repo rules (agents/claude/cline-rules)
   * at intake time, so later phases can verify enforcement. No-op (returns
   * undefined) when no workspace profile is wired (standalone consumers).
   */
  async captureRuleSnapshot(
    targetRepo: string,
    capturedAt: string,
  ): Promise<LoopRuleSnapshot | undefined> {
    if (!this.workspaceProfile) {
      return undefined;
    }

    const workspace = await this.workspaceProfile.resolve();
    const rules = await this.workspaceProfile.scanRules(workspace.root);
    const agentReadableRules = rules.rules.filter(
      (rule) => rule.status === 'present' && ['agents', 'claude', 'cline-rules'].includes(rule.id),
    );
    const evidence = agentReadableRules.map((rule) => rule.path);

    return {
      workspaceId: workspace.workspaceId,
      root: workspace.root || targetRepo,
      capturedAt,
      present: rules.present,
      total: rules.total,
      rules: rules.rules,
      diagnostics: rules.diagnostics,
      enforcement: {
        policy: 'snapshot-required',
        status: agentReadableRules.length > 0 ? 'enforced' : 'attention',
        agentReadable: agentReadableRules.length > 0,
        evidence,
      },
    };
  }

  /**
   * Read a loop issue detail through the source of truth and apply the caller's
   * detail enricher. The API facade owns HTTP exception mapping/logging; this
   * service keeps the domain read pipeline free of controller concerns.
   */
  async getIssue<TDetail extends LoopDetail>(
    issueId: string,
    enrichDetail: (detail: TDetail) => TDetail,
  ): Promise<TDetail> {
    const detail = this.persistence
      ? await this.persistence.readDetail(issueId)
      : await this.store.readDetail(issueId);
    return enrichDetail(detail as TDetail);
  }

  async list(
    query: LoopIssuesQuery,
    enrichList: (result: LoopListResponse) => Promise<LoopListResponse>,
  ): Promise<LoopListResponse> {
    const result = await (this.persistence?.list(query) ?? this.listFromFile(query));
    return enrichList(result);
  }

  private async listFromFile(query: LoopIssuesQuery): Promise<LoopListResponse> {
    const fallback = await this.store.list();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const items = fallback.issues
      .map((issue) => ({
        issue,
        state: fallback.loops.find((state) => state.issueId === issue.id),
      }))
      .filter(
        (item) =>
          (!query.status || item.issue.status === query.status) &&
          (!query.phase || item.state?.phase === query.phase) &&
          (!query.priority || item.issue.priority === query.priority) &&
          (!query.targetRepo || item.issue.targetRepo === query.targetRepo),
      );
    const start = (page - 1) * limit;
    return {
      list: items.slice(start, start + limit),
      total: items.length,
      page,
      limit,
    };
  }
}
