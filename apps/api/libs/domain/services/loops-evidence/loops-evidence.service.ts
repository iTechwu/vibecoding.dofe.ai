import { Injectable } from '@nestjs/common';
import type { LoopWorkflowRecipe } from '@repo/contracts';

/**
 * Structural input for {@link LoopsEvidenceService.inferWorkflowKind}. Only the
 * issue's title/body/targetRepo are read, so any `LoopListItem`/`LoopIssueDetail`
 * (both of which carry `issue.{title,body?,targetRepo}`) is assignable. The
 * concrete detail/list types are derived locally in `LoopsService` (from
 * `LoopsFileStoreService['readDetail']` / `LoopListResponse['list'][number]`)
 * and are not exported from `@repo/contracts`, so a structural type keeps this
 * domain service free of `src/modules/**` and of a store type import.
 */
type WorkflowKindInput = {
  issue: { title: string; body?: string | null; targetRepo: string };
};

/**
 * Loops Evidence domain service — `@app/services/loops-evidence`.
 *
 * 结构优化 Step 5：把交付证据 / delivery 派生的纯原语从 8000 行 `LoopsService` 下沉。
 *
 * 当前承接（本批，纯函数，无 DI 依赖）：
 * - `inferWorkflowKind`：从 issue 文本推断 workflow 类型（docs/bugfix/refactor/ops/feature），
 *   供 createIssue 的 recipe 派生、delivery evidence builder、eval baseline 复用。
 *
 * 后续 Step 补齐（大头，单独高风险循环）：`buildDeliveryEvidence` / `buildDeliveryEvidenceMarkdown`
 * / review & release gate builder / requirement coverage builder / evidence artifact builder
 * / `withRequirementsCoverage` / `withDeliveryControlsList`。这些 enricher 一旦沉淀，即可解锁
 * Step 2 的 `list`/`getIssue` 完整迁出。
 *
 * 依赖方向：仅 `@repo/contracts`。
 */
@Injectable()
export class LoopsEvidenceService {
  /** Infer the workflow kind from an issue's title/body/targetRepo text. */
  inferWorkflowKind(item: WorkflowKindInput): LoopWorkflowRecipe['appliesTo'][number] {
    const text =
      `${item.issue.title} ${item.issue.body ?? ''} ${item.issue.targetRepo}`.toLowerCase();
    if (text.includes('doc') || text.includes('文档')) return 'docs';
    if (text.includes('fix') || text.includes('bug') || text.includes('修复')) return 'bugfix';
    if (text.includes('refactor') || text.includes('重构')) return 'refactor';
    if (/\b(deploy|ops)\b/.test(text) || text.includes('运维')) return 'ops';
    return 'feature';
  }
}
