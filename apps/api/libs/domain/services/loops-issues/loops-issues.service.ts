import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AuthUserInfo } from '@app/auth/types/auth.interface';
import type {
  CreateLoopIssueRequest,
  CreateLoopIssueSimpleRequest,
  LoopIntake,
  LoopIssue,
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
}
