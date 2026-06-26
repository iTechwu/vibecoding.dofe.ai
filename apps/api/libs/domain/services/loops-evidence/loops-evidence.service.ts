import { Injectable } from '@nestjs/common';
import type {
  LoopDeliveryEvidence,
  LoopDeliveryEvidenceWorkPackage,
  LoopEvidenceArtifact,
  LoopPhase,
  LoopReleaseGate,
  LoopRequirementCoverage,
  LoopRequirementCoverageItem,
  LoopRequirementCoverageSummary,
  LoopReviewGate,
  LoopRuntimeSecurityException,
  LoopSecondOpinion,
  LoopStateItem,
  LoopWorkflowRecipe,
  LoopWorkflowStep,
  LoopListResponse,
  LoopGlobalReviewRecord,
  LoopReviewRecord,
} from '@repo/contracts';
import {
  buildPrimarySecondOpinionFindings,
  compareSecondOpinionFindings,
} from '@app/services/loops-quality';

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
  issue: {
    id: string;
    title: string;
    body?: string | null;
    targetRepo: string;
    rawPayloadRef: string;
  };
};

type WorkflowDefaultInput = {
  recipeId: string;
};

type DeliveryControlInput = WorkflowKindInput & {
  issue: WorkflowKindInput['issue'] & {
    status: string;
    updated: string;
  };
  state?: {
    paused?: boolean;
    phase?: LoopPhase;
    globalVerdict?: LoopStateItem['globalVerdict'];
    finalized?: boolean;
    specVersion?: string;
    shardsDone?: number;
    shardsTotal?: number;
    updated?: string;
  };
  spec?: {
    status: string;
  } | null;
  browserQaReports?: Array<{ status: string }>;
  reviewRecords?: Array<{ verdict: string; issues: unknown[] }>;
  globalReview?: { verdict: string; issues: unknown[] } | null;
  testRecords?: Array<{ status: string }>;
  intake?: unknown;
  evidenceArtifacts?: LoopEvidenceArtifact[];
  deliveryGovernance?: {
    requiredReviewGates?: {
      gateKinds: LoopReviewGate['kind'][];
    };
    reviewGateOverrides?: Array<{
      gateKind: LoopReviewGate['kind'];
      status: LoopReviewGate['status'];
      reason?: string;
      actor: string;
      updated: string;
    }>;
    releaseCanary?: {
      status: string;
      rollbackNote?: string;
    };
    workflowDefaults: Array<
      WorkflowDefaultInput & {
        loopKind: LoopWorkflowRecipe['appliesTo'][number];
        updated: string;
      }
    >;
  };
  convergencePr?: unknown;
  workflowRecipe?: LoopWorkflowRecipe;
};

type RuntimeSecurityInput = {
  testRecords: Array<{
    id: string;
    shardId: string;
    round: number;
    status: string;
    commands: Array<{ command: string }>;
    runtimeSecurityPolicy?: {
      canary: {
        leakedInCommands: string[];
      };
    };
    failedTests: Array<{
      name: string;
      reason: string;
    }>;
    created: string;
  }>;
};

type SecondOpinionPolicyInput = {
  issue: { updated: string };
  state: { updated?: string };
  deliveryGovernance?: {
    secondOpinionPolicy?: {
      requiredForRelease: boolean;
      conflictHumanGate: boolean;
      updated: string;
    };
  };
};

type SecondOpinionInput = SecondOpinionPolicyInput & {
  issue: SecondOpinionPolicyInput['issue'] & {
    id: string;
  };
  reviewRecords: LoopReviewRecord[];
  globalReview?: LoopGlobalReviewRecord;
  secondOpinion?: LoopSecondOpinion;
};

type RulesComplianceInput = {
  implementationRecords: Array<{
    changedFiles?: string[];
    notes?: string;
    summary: string;
    shardId: string;
  }>;
  testRecords: Array<{ status: string }>;
  shards: Array<{ id: string; status: string }>;
};

type ReleaseGateBlockerInput = RulesComplianceInput & {
  issue: { id: string };
  deliveryGovernance?: {
    secondOpinionResolutions?: Array<{
      conflictFingerprint?: string;
    }>;
  };
};

type RequirementsCoverageInput = {
  issue: {
    acceptanceCriteria: string[];
  };
  spec?: {
    body: string;
  } | null;
  shards: Array<{
    id: string;
    acceptance: string[];
  }>;
  testMatrix?: {
    requiredTests: Array<{
      id: string;
      shardId: string;
      title: string;
    }>;
  } | null;
  implementationRecords: Array<{
    id: string;
    shardId: string;
  }>;
  reviewRecords: Array<{
    id: string;
    shardId: string;
    verdict: string;
  }>;
  state: {
    globalVerdict?: LoopStateItem['globalVerdict'];
  };
};

type EvidenceArtifactInput = {
  issue: {
    id: string;
    rawPayloadRef?: string;
    sourceChannel: string;
    sourceKind: string;
    submitterName?: string | null;
    submitterId: string;
    priority: string;
    status: string;
    acceptanceCriteria: string[];
  };
  intake: {
    id: string;
    status: string;
    sourceChannel: string;
    sourceKind: string;
  };
  state: {
    specVersion: string;
  };
  spec?: {
    status: string;
    version: string;
  } | null;
  shards: Array<{
    id: string;
    status: string;
  }>;
  testMatrix?: {
    requiredTests: unknown[];
    regressionScope: unknown[];
  } | null;
  annotations: unknown[];
  implementationRecords: Array<{
    id: string;
    shardId: string;
    round: number;
    changedFiles: string[];
    status: string;
  }>;
  testRecords: Array<{
    id: string;
    shardId: string;
    round: number;
    commands: unknown[];
    status: string;
  }>;
  reviewRecords: Array<{
    id: string;
    shardId: string;
    round: number;
    issues: unknown[];
    verdict: string;
  }>;
  globalReview?: {
    round: number;
    verdict: string;
    issues: unknown[];
  } | null;
  convergencePr?: {
    commits: unknown[];
  } | null;
  browserQaReports?: Array<{
    id: string;
    status: string;
    targetUrl: string;
    screenshots: unknown[];
    consoleErrors: unknown[];
    networkFailures: unknown[];
    traces?: unknown[];
    visualDiffs?: unknown[];
    handoffs?: unknown[];
  }>;
  secondOpinion?: {
    id: string;
    status: string;
    secondary: {
      status: string;
    };
    comparison: {
      conflictCount: number;
    };
  } | null;
};

type DeliveryEvidenceMarkdownInput = {
  issueId: string;
  title: string;
  specSummary: string;
  workPackages: LoopDeliveryEvidenceWorkPackage[];
  testTotal: number;
  testPassed: number;
  testFailed: number;
  coverage: string;
  shardReviews: number;
  findings: number;
  globalVerdict: string;
  risks: LoopDeliveryEvidence['risks'];
  costTokens: number;
  costCalls: number;
  budget: string;
  prReady: boolean;
  prStatus: string;
  finalized: boolean;
  firstPass: boolean;
  runtimeViolationCount: number;
  browserQaStatus: string;
  secondOpinionStatus: string;
};

type RequirementsCoverageEnricherInput = RequirementsCoverageInput &
  EvidenceArtifactInput &
  DeliveryControlInput;

type DeliveryControlsListItem = LoopListResponse['list'][number] & DeliveryControlInput;
type DeliveryControlsListDetail = DeliveryControlsListItem &
  RuntimeSecurityInput & {
    deliveryGovernance?: DeliveryControlInput['deliveryGovernance'];
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

  buildWorkflowBaselineEvidence(
    item: WorkflowKindInput,
    workflowDefault?: WorkflowDefaultInput,
  ): LoopWorkflowRecipe['baselineEvidence'] {
    const loopKind = this.inferWorkflowKind(item);
    const workflowId = workflowDefault?.recipeId ?? `default-${loopKind}`;
    return [
      {
        id: `${item.issue.id}-baseline-blueprint`,
        kind: 'blueprint',
        label: 'Blueprint version',
        value: `${workflowId}@v1`,
        evidenceRef: item.issue.rawPayloadRef,
      },
      {
        id: `${item.issue.id}-baseline-runtime`,
        kind: 'runtime',
        label: 'Runtime plan',
        value: 'Codex review/control + Claude Code implementation',
      },
      {
        id: `${item.issue.id}-baseline-eval`,
        kind: 'eval',
        label: 'Eval suite',
        value: 'architecture, delivery, runtime, test, cost hard gates',
      },
      {
        id: `${item.issue.id}-baseline-gates`,
        kind: 'gate',
        label: 'Human and release gates',
        value: 'spec approval, review gates, release gate',
      },
    ];
  }

  deliveryBlockedReason(item: DeliveryControlInput): string | undefined {
    if (item.state?.paused || item.state?.phase === 'PAUSED') return 'Loop is paused';
    if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') {
      return `Global review ${item.state.globalVerdict}`;
    }
    return undefined;
  }

  isSpecApproved(item: DeliveryControlInput): boolean {
    return Boolean(
      item.spec?.status === 'APPROVED' ||
      (item.state?.specVersion &&
        item.state.specVersion !== 'v0' &&
        this.phaseAtLeast(item, 'PHASE_3_DECOMPOSE')),
    );
  }

  isImplementationDone(item: DeliveryControlInput): boolean {
    const shardsDone = item.state?.shardsDone ?? 0;
    const shardsTotal = item.state?.shardsTotal ?? 0;
    return shardsTotal > 0 && shardsDone >= shardsTotal;
  }

  isReviewPassed(item: DeliveryControlInput): boolean {
    return item.issue.status === 'CLOSED' || item.state?.globalVerdict === 'PASS';
  }

  isBrowserQaPassed(item: DeliveryControlInput): boolean {
    const reports = this.asDetail(item)?.browserQaReports ?? [];
    if (reports.length > 0) {
      return reports[0]?.status === 'passed';
    }
    const phase = item.state?.phase ?? 'PHASE_0_INTAKE';
    return (
      item.issue.status === 'CLOSED' ||
      ['PHASE_7_GLOBAL_REVIEW', 'PHASE_8_ANNOTATE', 'CLOSED'].includes(phase)
    );
  }

  isReleaseReady(item: DeliveryControlInput): boolean {
    return (
      (item.issue.status === 'CLOSED' || item.state?.finalized || item.state?.phase === 'CLOSED') &&
      this.isSpecApproved(item) &&
      this.isImplementationDone(item) &&
      this.isReviewPassed(item)
    );
  }

  testsPassed(item: DeliveryControlInput): boolean {
    const detail = this.asDetail(item);
    if (!detail) return this.isReviewPassed(item);
    return (
      (detail.testRecords?.length ?? 0) > 0 &&
      (detail.testRecords ?? []).every((record) => record.status === 'TEST-PASS')
    );
  }

  reviewFindingsCount(item: DeliveryControlInput): number {
    const detail = this.asDetail(item);
    if (!detail) return item.state?.globalVerdict && item.state.globalVerdict !== 'PASS' ? 1 : 0;
    return (
      (detail.reviewRecords ?? []).reduce((total, record) => total + record.issues.length, 0) +
      (detail.globalReview?.issues.length ?? 0)
    );
  }

  phaseAtLeast(item: DeliveryControlInput, phase: LoopPhase): boolean {
    if (item.issue.status === 'CLOSED' || item.state?.finalized) return true;
    const order: Partial<Record<LoopPhase, number>> = {
      PHASE_0_INTAKE: 0,
      PHASE_1_SPEC: 1,
      PHASE_2_REVIEW: 2,
      PHASE_3_DECOMPOSE: 3,
      PHASE_4_IMPLEMENT: 4,
      PHASE_5_REVIEW: 5,
      PHASE_6_CONVERGE: 6,
      PHASE_7_GLOBAL_REVIEW: 7,
      PHASE_8_ANNOTATE: 8,
      CLOSED: 9,
      PAUSED: -1,
    };
    return (order[item.state?.phase ?? 'PHASE_0_INTAKE'] ?? 0) >= (order[phase] ?? 0);
  }

  buildRuntimeSecurityExceptions(detail: RuntimeSecurityInput): LoopRuntimeSecurityException[] {
    return detail.testRecords.flatMap((record) =>
      record.failedTests
        .filter((failure) => failure.name.startsWith('runtime-security:'))
        .map((failure, index) => ({
          id: `${record.id}-${failure.name}-${index}`,
          testRecordId: record.id,
          shardId: record.shardId,
          round: record.round,
          level: failure.name === 'runtime-security:canary' ? 'critical' : 'warning',
          reason: failure.reason,
          evidence: `${failure.name} · ${record.status}`,
          command:
            record.commands.find((command) => failure.reason.includes(command.command))?.command ??
            record.runtimeSecurityPolicy?.canary.leakedInCommands[0],
          created: record.created,
        })),
    );
  }

  applySecondOpinionPolicy(
    detail: SecondOpinionPolicyInput,
    report: LoopSecondOpinion,
  ): LoopSecondOpinion {
    const policy = detail.deliveryGovernance?.secondOpinionPolicy;
    if (!policy) return report;
    const status =
      policy.conflictHumanGate && report.comparison.conflictCount > 0
        ? 'conflict'
        : policy.requiredForRelease
          ? report.secondary.status === 'passed' && report.primary.status === 'passed'
            ? 'passed'
            : report.status === 'needs_changes' || report.primary.status === 'needs_changes'
              ? 'needs_changes'
              : 'pending'
          : report.status;
    return {
      ...report,
      status,
      requiredForRelease: policy.requiredForRelease,
      updated: policy.updated,
    };
  }

  isSecondOpinionReviewerPassed(status: LoopSecondOpinion['secondary']['status']): boolean {
    return status === 'passed';
  }

  buildSecondOpinion(detail: SecondOpinionInput): LoopSecondOpinion {
    if (detail.secondOpinion) {
      return this.applySecondOpinionPolicy(detail, detail.secondOpinion);
    }
    const primaryEvidenceIds = [
      ...detail.reviewRecords.map((record) => record.id),
      ...(detail.globalReview ? [detail.globalReview.id] : []),
    ];
    const primaryFindings = buildPrimarySecondOpinionFindings({
      reviewRecords: detail.reviewRecords,
      globalReview: detail.globalReview,
    });
    const comparison = compareSecondOpinionFindings({ primary: primaryFindings, secondary: [] });
    const primaryPassed = Boolean(
      detail.globalReview?.verdict === 'PASS' ||
      (detail.reviewRecords.length > 0 &&
        detail.reviewRecords.every((record) => record.verdict === 'PASS')),
    );
    const primaryStatus: LoopSecondOpinion['primary']['status'] =
      primaryEvidenceIds.length === 0
        ? 'not_run'
        : primaryFindings.length > 0
          ? 'needs_changes'
          : primaryPassed
            ? 'passed'
            : 'pending';
    const secondaryStatus: LoopSecondOpinion['secondary']['status'] = detail.globalReview
      ? 'pending'
      : 'not_run';
    const requiredForRelease =
      detail.deliveryGovernance?.secondOpinionPolicy?.requiredForRelease ?? false;
    const conflictHumanGate =
      detail.deliveryGovernance?.secondOpinionPolicy?.conflictHumanGate ?? true;
    const hasConflict = comparison.conflictCount > 0 && conflictHumanGate;

    return this.applySecondOpinionPolicy(detail, {
      id: `${detail.issue.id}-second-opinion`,
      status: hasConflict
        ? 'conflict'
        : requiredForRelease
          ? this.isSecondOpinionReviewerPassed(secondaryStatus) && primaryStatus === 'passed'
            ? 'passed'
            : primaryStatus === 'needs_changes'
              ? 'needs_changes'
              : 'pending'
          : 'not_required',
      primary: {
        role: 'primary',
        reviewer: 'codex',
        status: primaryStatus,
        findingsCount: primaryFindings.length,
        findings: primaryFindings,
        evidenceIds: primaryEvidenceIds,
        summary:
          primaryEvidenceIds.length > 0
            ? `Codex primary review has ${primaryFindings.length} finding(s) across shard and global review evidence.`
            : 'Codex primary review has not produced evidence yet.',
      },
      secondary: {
        role: 'secondary',
        reviewer: 'claude-code',
        status: secondaryStatus,
        findingsCount: 0,
        findings: [],
        evidenceIds: [],
        summary:
          secondaryStatus === 'pending'
            ? 'Claude Code secondary review is not required for release yet; enable the second-opinion worker to compare findings.'
            : 'Claude Code secondary review has not run yet.',
      },
      comparison: {
        ...comparison,
      },
      requiredForRelease,
      updated: detail.state.updated ?? detail.issue.updated,
    });
  }

  checkRulesCompliance(detail: RulesComplianceInput): string[] {
    const violations: string[] = [];
    const records = detail.implementationRecords ?? [];
    const changedFiles = records.flatMap((record) => record.changedFiles ?? []);

    const sensitiveFiles = changedFiles.filter(
      (file) =>
        file.includes('.env') ||
        file.includes('secret') ||
        file.includes('credentials') ||
        file.includes('private_key'),
    );
    if (sensitiveFiles.length > 0) {
      violations.push(`[Architecture] Sensitive files modified: ${sensitiveFiles.join(', ')}`);
    }

    const srcFiles = changedFiles.filter(
      (file) => file.startsWith('apps/api/src/') || file.startsWith('apps/web/app/'),
    );
    if (
      srcFiles.length > 0 &&
      !detail.testRecords.some((record) => record.status === 'TEST-PASS')
    ) {
      violations.push('[Testing] No passing test records found for source file changes');
    }

    const apiFiles = changedFiles.filter((file) => file.startsWith('apps/api/src/'));
    const contractFiles = changedFiles.filter((file) => file.startsWith('packages/contracts/'));
    if (apiFiles.length > 0 && contractFiles.length === 0) {
      violations.push(
        '[Architecture] API source files changed without contract updates — verify Zod/ts-rest contract',
      );
    }

    const controllerFiles = changedFiles.filter((file) => file.includes('controller'));
    if (controllerFiles.length > 0) {
      const implNotes = records.map((record) => record.notes ?? '').join(' ');
      const summary = records.map((record) => record.summary).join(' ');
      const combined = `${implNotes} ${summary}`.toLowerCase();
      if (/axios|fetch|http\.request/.test(combined)) {
        violations.push(
          '[Architecture] Controller changes with direct HTTP calls detected — use Client layer',
        );
      }
    }

    const implementedShardIds = new Set(records.map((record) => record.shardId));
    const unimplementedShards = detail.shards.filter(
      (shard) => shard.status !== 'TODO' && !implementedShardIds.has(shard.id),
    );
    if (unimplementedShards.length > 0) {
      violations.push(
        `[Workspace] ${unimplementedShards.length} shard(s) in non-TODO status without implementation records`,
      );
    }

    return violations;
  }

  buildReleaseGateBlockers(input: {
    detail: ReleaseGateBlockerInput;
    releaseGate: LoopReleaseGate;
    secondOpinion?: LoopSecondOpinion;
  }): string[] {
    const blockers: string[] = [];
    if (!input.releaseGate.checklist.specApproved) blockers.push('Spec is not approved');
    if (!input.releaseGate.checklist.implementationEvidence) {
      blockers.push('Implementation evidence is missing');
    }
    if (!input.releaseGate.checklist.testsPassed) blockers.push('Tests have not all passed');
    if (!input.releaseGate.checklist.requiredReviewsPassed) {
      blockers.push('Required reviews have not all passed or been waived');
    }
    if (input.secondOpinion?.requiredForRelease && input.secondOpinion.status === 'conflict') {
      const resolutions = input.detail.deliveryGovernance?.secondOpinionResolutions ?? [];
      const conflictFingerprints = input.secondOpinion.comparison.conflictFingerprints;
      const resolvedFingerprints = new Set(
        resolutions
          .map((resolution) => resolution.conflictFingerprint)
          .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
      );
      const unresolvedCount =
        conflictFingerprints.length > 0
          ? conflictFingerprints.filter((fingerprint) => !resolvedFingerprints.has(fingerprint))
              .length
          : Math.max(input.secondOpinion.comparison.conflictCount - resolutions.length, 0);
      if (unresolvedCount > 0) {
        blockers.push(
          `Second opinion has ${unresolvedCount} unresolved conflict(s); resolve or waive before shipping`,
        );
      }
    }
    if (!input.releaseGate.checklist.browserQaPassed) blockers.push('Browser QA has not passed');
    if (!input.releaseGate.checklist.rollbackNote) {
      blockers.push('Rollback note is missing — required for all releases');
    }
    if (input.releaseGate.checklist.canaryPassed === false) {
      blockers.push('Release canary has not passed');
    }

    const rulesViolations = this.checkRulesCompliance(input.detail);
    if (rulesViolations.length > 0) {
      blockers.push(
        `Rules Center violations detected:\n${rulesViolations.map((violation) => `  - ${violation}`).join('\n')}`,
      );
    }
    return blockers;
  }

  buildDeliveryEvidenceMarkdown(input: DeliveryEvidenceMarkdownInput): string {
    const lines: string[] = [];
    lines.push(`# Delivery Evidence — ${input.title}`, '');
    lines.push(`- **Issue**: ${input.issueId}`);
    lines.push(`- **Spec**: ${input.specSummary}`);
    lines.push(`- **Global verdict**: ${input.globalVerdict}`);
    lines.push(`- **PR status**: ${input.prStatus}`);
    lines.push(`- **PR ready**: ${input.prReady ? 'yes' : 'no'}`, '');
    lines.push('## Work Packages', '');
    if (input.workPackages.length === 0) {
      lines.push('_No work packages recorded._', '');
    } else {
      for (const wp of input.workPackages) {
        const commit = wp.commitSha ? ` · commit: ${wp.commitSha.slice(0, 12)}` : '';
        lines.push(
          `- **${wp.id}** ${wp.title} — status: ${wp.status} · tests: ${wp.tests} · review: ${wp.review}${commit}`,
        );
        if (wp.files.length > 0) lines.push(`  - files: ${wp.files.join(', ')}`);
        if (wp.commitMessage) lines.push(`  - commit message: ${wp.commitMessage}`);
      }
      lines.push('');
    }
    lines.push('## Tests', '');
    lines.push(`- ${input.testPassed}/${input.testTotal} passed · ${input.testFailed} failed`);
    lines.push(`- coverage: ${input.coverage}`, '');
    lines.push('## Reviews', '');
    lines.push(`- ${input.shardReviews} shard reviews · ${input.findings} findings`);
    lines.push(`- global verdict: ${input.globalVerdict}`, '');
    lines.push('## Cost', '');
    lines.push(
      `- tokens: ${input.costTokens} · calls: ${input.costCalls} · budget: ${input.budget}`,
      '',
    );
    if (input.risks.length > 0) {
      lines.push('## Risks', '');
      for (const risk of input.risks) lines.push(`- **${risk.severity}**: ${risk.description}`);
      lines.push('');
    }
    lines.push('## Quality Signals', '');
    lines.push(
      `- **First-pass**: ${input.firstPass ? 'yes (no rework required)' : 'no (rework or re-loop recorded)'}`,
    );
    lines.push(
      `- **Runtime violations**: ${input.runtimeViolationCount > 0 ? `${input.runtimeViolationCount} security exception(s)` : 'none recorded'}`,
    );
    lines.push(`- **Browser QA**: ${input.browserQaStatus}`);
    lines.push(`- **Second opinion**: ${input.secondOpinionStatus}`, '');
    lines.push('---');
    lines.push(`_Generated by DofeAI Loops Control Plane. Runtime: Codex CLI / Claude Code CLI._`);
    return lines.join('\n');
  }

  buildRequirementsCoverage(detail: RequirementsCoverageInput): LoopRequirementCoverage {
    const items = detail.issue.acceptanceCriteria.map((criterion, index) => {
      const normalized = this.normalizeCoverageText(criterion);
      const shardIds = detail.shards
        .filter((shard) =>
          shard.acceptance.some((item) => this.coverageTextMatches(item, normalized)),
        )
        .map((shard) => shard.id);
      const testIds =
        detail.testMatrix?.requiredTests
          .filter(
            (test) =>
              shardIds.includes(test.shardId) || this.coverageTextMatches(test.title, normalized),
          )
          .map((test) => test.id) ?? [];
      const implementationRecordIds = detail.implementationRecords
        .filter((record) => shardIds.includes(record.shardId))
        .map((record) => record.id);
      const reviewRecordIds = detail.reviewRecords
        .filter((record) => shardIds.includes(record.shardId) && record.verdict === 'PASS')
        .map((record) => record.id);
      const inSpec = detail.spec ? this.coverageTextMatches(detail.spec.body, normalized) : false;
      const status = this.resolveRequirementStatus({
        inSpec,
        shardIds,
        testIds,
        implementationRecordIds,
        reviewRecordIds,
        globalVerdict: detail.state.globalVerdict,
      });

      return {
        id: `REQ-${index + 1}`,
        criterion,
        inSpec,
        shardIds,
        testIds,
        implementationRecordIds,
        reviewRecordIds,
        status,
      };
    });

    return {
      summary: this.summarizeRequirementsCoverage(items),
      items,
    };
  }

  resolveRequirementStatus(input: {
    inSpec: boolean;
    shardIds: string[];
    testIds: string[];
    implementationRecordIds: string[];
    reviewRecordIds: string[];
    globalVerdict?: LoopStateItem['globalVerdict'];
  }): LoopRequirementCoverageItem['status'] {
    if (input.globalVerdict === 'PASS' && input.reviewRecordIds.length > 0) return 'accepted';
    if (input.reviewRecordIds.length > 0) return 'reviewed';
    if (input.testIds.length > 0 && input.implementationRecordIds.length > 0) return 'tested';
    if (input.implementationRecordIds.length > 0) return 'implemented';
    if (input.inSpec && input.shardIds.length > 0 && input.testIds.length > 0) return 'planned';
    return 'missing';
  }

  summarizeRequirementsCoverage(
    items: LoopRequirementCoverageItem[],
  ): LoopRequirementCoverageSummary {
    const summary = this.emptyCoverageSummary(items.length);
    for (const item of items) summary[item.status] += 1;
    summary.percent =
      summary.total === 0 ? 100 : Math.round((summary.accepted / summary.total) * 100);
    return summary;
  }

  aggregateCoverageSummaries(
    summaries: LoopRequirementCoverageSummary[],
  ): LoopRequirementCoverageSummary {
    const total = summaries.reduce((acc, item) => acc + item.total, 0);
    const summary = this.emptyCoverageSummary(total);
    for (const item of summaries) {
      summary.accepted += item.accepted;
      summary.reviewed += item.reviewed;
      summary.tested += item.tested;
      summary.implemented += item.implemented;
      summary.planned += item.planned;
      summary.missing += item.missing;
    }
    summary.percent = total === 0 ? 100 : Math.round((summary.accepted / total) * 100);
    return summary;
  }

  emptyCoverageSummary(total = 0): LoopRequirementCoverageSummary {
    return {
      total,
      accepted: 0,
      reviewed: 0,
      tested: 0,
      implemented: 0,
      planned: 0,
      missing: 0,
      percent: total === 0 ? 100 : 0,
    };
  }

  coverageTextMatches(text: string, normalizedNeedle: string): boolean {
    const haystack = this.normalizeCoverageText(text);
    return Boolean(
      normalizedNeedle &&
      haystack &&
      (haystack.includes(normalizedNeedle) || normalizedNeedle.includes(haystack)),
    );
  }

  normalizeCoverageText(value: string): string {
    return value
      .toLowerCase()
      .replace(/^-+\s*/, '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '');
  }

  buildEvidenceArtifacts(detail: EvidenceArtifactInput): LoopEvidenceArtifact[] {
    const issueId = detail.issue.id;
    const artifacts: LoopEvidenceArtifact[] = [
      {
        id: `${issueId}-raw-payload`,
        label: 'Raw Payload',
        kind: 'raw-payload',
        path: detail.issue.rawPayloadRef ?? `.loops/intakes/${detail.intake.id}.raw.json`,
        status: 'present',
        summary: `Original ${detail.issue.sourceChannel}/${detail.issue.sourceKind} request from ${detail.issue.submitterName ?? detail.issue.submitterId}.`,
      },
      {
        id: `${issueId}-issue`,
        label: 'Issue Record',
        kind: 'issue',
        path: `.loops/issues/${issueId}.json`,
        status: 'present',
        summary: `${detail.issue.priority} ${detail.issue.status} issue with ${detail.issue.acceptanceCriteria.length} initial acceptance criteria.`,
      },
      {
        id: `${issueId}-intake`,
        label: 'Intake Record',
        kind: 'intake',
        path: `.loops/intakes/${detail.intake.id}.json`,
        status: 'present',
        summary: `${detail.intake.status} intake normalized from ${detail.intake.sourceChannel}/${detail.intake.sourceKind}.`,
      },
      {
        id: `${issueId}-spec`,
        label: 'Spec',
        kind: 'spec',
        path: `.loops/specs/${issueId}/spec.${detail.state.specVersion}.json`,
        status: detail.spec ? 'present' : 'pending',
        summary: detail.spec
          ? `${detail.spec.status} spec ${detail.spec.version} maps ${detail.issue.acceptanceCriteria.length} initial acceptance criteria.`
          : `Spec ${detail.state.specVersion} has not been generated yet.`,
      },
      {
        id: `${issueId}-shards`,
        label: 'Shards',
        kind: 'shards',
        path: `.loops/shards/${issueId}/shards.json`,
        status: detail.shards.length > 0 ? 'present' : 'pending',
        count: detail.shards.length,
        summary:
          detail.shards.length > 0
            ? `${detail.shards.filter((shard) => shard.status === 'DONE').length}/${detail.shards.length} shards done; ${detail.shards.filter((shard) => shard.status === 'IN_PROGRESS').length} in progress.`
            : 'No implementation shards have been decomposed yet.',
      },
      {
        id: `${issueId}-test-matrix`,
        label: 'Test Matrix',
        kind: 'test-matrix',
        path: `.loops/tests/${issueId}/matrix.json`,
        status: detail.testMatrix ? 'present' : 'pending',
        count: detail.testMatrix?.requiredTests.length,
        summary: detail.testMatrix
          ? `${detail.testMatrix.requiredTests.length} required tests across ${detail.testMatrix.regressionScope.length} regression targets.`
          : 'Test matrix is pending until decomposition completes.',
      },
      {
        id: `${issueId}-annotations`,
        label: 'Annotations',
        kind: 'annotations',
        path: `.loops/annotations/${issueId}.json`,
        status: detail.annotations.length > 0 ? 'present' : 'pending',
        count: detail.annotations.length,
        summary:
          detail.annotations.length > 0
            ? `${detail.annotations.length} reviewer annotations captured for requirement coverage.`
            : 'No reviewer annotations have been recorded yet.',
      },
    ];

    artifacts.push(
      ...detail.implementationRecords.map((record) => ({
        id: record.id,
        label: `Implementation ${record.shardId}`,
        kind: 'implementation-record' as const,
        path: `.loops/runs/${issueId}/${record.shardId}/${record.round}/implementation.json`,
        status: 'present' as const,
        round: record.round,
        count: record.changedFiles.length,
        summary: `${record.status} implementation for ${record.shardId}; ${record.changedFiles.length} changed files recorded.`,
      })),
      ...detail.testRecords.map((record) => ({
        id: record.id,
        label: `Test ${record.shardId}`,
        kind: 'test-record' as const,
        path: `.loops/tests/${issueId}/records/${record.id}.json`,
        status: 'present' as const,
        round: record.round,
        count: record.commands.length,
        summary: `${record.status} test run for ${record.shardId}; ${record.commands.length} commands executed.`,
      })),
      ...detail.reviewRecords.map((record) => ({
        id: record.id,
        label: `Review ${record.shardId}`,
        kind: 'review-record' as const,
        path: `.loops/runs/${issueId}/${record.shardId}/${record.round}/review.json`,
        status: 'present' as const,
        round: record.round,
        count: record.issues.length,
        summary: `${record.verdict} review for ${record.shardId}; ${record.issues.length} issues recorded.`,
      })),
    );

    artifacts.push({
      id: `${issueId}-global-review`,
      label: 'Global Review',
      kind: 'global-review',
      path: `.loops/runs/${issueId}/global-review.json`,
      status: detail.globalReview ? 'present' : 'pending',
      round: detail.globalReview?.round,
      summary: detail.globalReview
        ? `${detail.globalReview.verdict} global review with ${detail.globalReview.issues.length} cross-shard issues.`
        : 'Global review has not been run yet.',
    });
    artifacts.push({
      id: `${issueId}-convergence-pr`,
      label: 'Convergence PR',
      kind: 'convergence-pr',
      path: `.loops/runs/${issueId}/convergence-pr.json`,
      status: detail.convergencePr ? 'present' : 'pending',
      count: detail.convergencePr?.commits.length,
      summary: detail.convergencePr
        ? `Convergence package references ${detail.convergencePr.commits.length} commits.`
        : 'Convergence PR evidence is pending until finalization.',
    });
    const latestBrowserQa = detail.browserQaReports?.[0];
    artifacts.push({
      id: latestBrowserQa?.id ?? `${issueId}-browser-qa`,
      label: 'Browser QA',
      kind: 'browser-qa',
      path: latestBrowserQa
        ? `.loops/runs/${issueId}/browser-qa/${latestBrowserQa.id}.json`
        : `.loops/runs/${issueId}/browser-qa`,
      status: latestBrowserQa ? 'present' : 'pending',
      count: latestBrowserQa
        ? latestBrowserQa.consoleErrors.length + latestBrowserQa.networkFailures.length
        : undefined,
      summary: latestBrowserQa
        ? `${latestBrowserQa.status} browser QA for ${latestBrowserQa.targetUrl}; ${latestBrowserQa.screenshots.length} screenshots, ${latestBrowserQa.traces?.length ?? 0} traces, ${latestBrowserQa.visualDiffs?.length ?? 0} visual checks and ${latestBrowserQa.handoffs?.length ?? 0} handoffs captured.`
        : 'Browser QA report has not been run yet.',
    });
    artifacts.push({
      id: detail.secondOpinion?.id ?? `${issueId}-second-opinion`,
      label: 'Second Opinion',
      kind: 'second-opinion',
      path: `.loops/runs/${issueId}/second-opinion.json`,
      status: detail.secondOpinion ? 'present' : 'pending',
      count: detail.secondOpinion?.comparison.conflictCount,
      summary: detail.secondOpinion
        ? `${detail.secondOpinion.status} second opinion; secondary reviewer ${detail.secondOpinion.secondary.status}.`
        : 'Second opinion worker has not produced evidence yet.',
    });

    return artifacts;
  }

  evidenceIdsByKind(item: DeliveryControlInput) {
    const detail = this.asDetail(item);
    return (kind: LoopEvidenceArtifact['kind']) =>
      detail?.evidenceArtifacts
        ?.filter((artifact) => artifact.kind === kind)
        .map((artifact) => artifact.id) ?? [];
  }

  buildReviewGates(item: DeliveryControlInput): LoopReviewGate[] {
    const updated = item.state?.updated ?? item.issue.updated;
    const blockedReason = this.deliveryBlockedReason(item);
    const specApproved = this.isSpecApproved(item);
    const implementationDone = this.isImplementationDone(item);
    const reviewPassed = this.isReviewPassed(item);
    const findingsCount = this.reviewFindingsCount(item);
    const evidenceByKind = this.evidenceIdsByKind(item);

    const gates: LoopReviewGate[] = [
      {
        id: `${item.issue.id}-gate-product`,
        kind: 'product',
        status:
          blockedReason && item.state?.phase === 'PHASE_2_REVIEW'
            ? 'blocked'
            : specApproved
              ? 'passed'
              : 'pending',
        reviewer: 'human',
        confidence: specApproved ? 0.9 : undefined,
        findingsCount: 0,
        evidenceId: evidenceByKind('spec')[0],
        requiredByStepId: `${item.issue.id}-spec-review`,
        updated,
      },
      {
        id: `${item.issue.id}-gate-architecture`,
        kind: 'architecture',
        status: this.phaseAtLeast(item, 'PHASE_3_DECOMPOSE') ? 'passed' : 'pending',
        reviewer: 'codex',
        confidence: this.phaseAtLeast(item, 'PHASE_3_DECOMPOSE') ? 0.8 : undefined,
        findingsCount: 0,
        evidenceId: evidenceByKind('shards')[0],
        requiredByStepId: `${item.issue.id}-implementation`,
        updated,
      },
      {
        id: `${item.issue.id}-gate-code`,
        kind: 'code',
        status: blockedReason
          ? 'blocked'
          : reviewPassed
            ? 'passed'
            : findingsCount > 0
              ? 'needs_changes'
              : implementationDone
                ? 'pending'
                : 'pending',
        reviewer: 'codex',
        confidence: reviewPassed ? 0.85 : undefined,
        findingsCount,
        evidenceId: evidenceByKind('review-record')[0] ?? evidenceByKind('global-review')[0],
        requiredByStepId: `${item.issue.id}-code-review`,
        updated,
      },
      {
        id: `${item.issue.id}-gate-security`,
        kind: 'security',
        status: this.isReleaseReady(item) ? 'passed' : 'pending',
        reviewer: 'codex',
        confidence: this.isReleaseReady(item) ? 0.7 : undefined,
        findingsCount: 0,
        evidenceId: evidenceByKind('global-review')[0],
        requiredByStepId: `${item.issue.id}-release-gate`,
        updated,
      },
    ];
    const governance = this.asDetail(item)?.deliveryGovernance;
    const requiredKinds = governance?.requiredReviewGates?.gateKinds;
    const scopedGates = requiredKinds?.length
      ? gates.filter((gate) => requiredKinds.includes(gate.kind))
      : gates;
    const overrides = governance?.reviewGateOverrides ?? [];
    return scopedGates.map((gate) => {
      const override = overrides.find((item) => item.gateKind === gate.kind);
      if (!override) return gate;
      return {
        ...gate,
        status: override.status,
        reviewer: 'human',
        confidence:
          override.status === 'passed' || override.status === 'waived' ? 1 : gate.confidence,
        waiverReason:
          override.status === 'waived' || override.status === 'blocked'
            ? (override.reason ?? `Governed by ${override.actor}`)
            : gate.waiverReason,
        updated: override.updated,
      };
    });
  }

  buildWorkflowRecipe(item: DeliveryControlInput): LoopWorkflowRecipe {
    const phase = item.state?.phase ?? 'PHASE_0_INTAKE';
    const blockedReason = this.deliveryBlockedReason(item);
    const evidenceByKind = this.evidenceIdsByKind(item);
    const specApproved = this.isSpecApproved(item);
    const implementationDone = this.isImplementationDone(item);
    const reviewPassed = this.isReviewPassed(item);
    const browserQaPassed = this.isBrowserQaPassed(item);
    const releaseReady = this.isReleaseReady(item);
    const updated = item.state?.updated ?? item.issue.updated;
    const snapshot = this.asDetail(item)?.workflowRecipe;
    const governance = this.asDetail(item)?.deliveryGovernance;
    const workflowDefault = governance?.workflowDefaults.find(
      (entry) => entry.loopKind === this.inferWorkflowKind(item),
    );

    const steps: LoopWorkflowStep[] = [
      {
        id: `${item.issue.id}-intake`,
        kind: 'intake',
        label: 'Intake',
        required: true,
        status: 'passed',
        owner: 'system',
        humanGate: 'none',
        phase: 'PHASE_0_INTAKE',
        evidenceTypes: ['raw-payload', 'issue', 'intake'],
        evidenceIds: [
          ...evidenceByKind('raw-payload'),
          ...evidenceByKind('issue'),
          ...evidenceByKind('intake'),
        ],
      },
      {
        id: `${item.issue.id}-spec-review`,
        kind: 'spec_review',
        label: 'Spec Review',
        required: true,
        status:
          blockedReason && phase === 'PHASE_2_REVIEW'
            ? 'blocked'
            : specApproved
              ? 'passed'
              : 'current',
        owner: 'codex',
        humanGate: 'approval',
        phase: 'PHASE_2_REVIEW',
        evidenceTypes: ['spec'],
        evidenceIds: evidenceByKind('spec'),
        blockedReason: blockedReason && phase === 'PHASE_2_REVIEW' ? blockedReason : undefined,
      },
      {
        id: `${item.issue.id}-implementation`,
        kind: 'implementation',
        label: 'Implementation',
        required: true,
        status:
          blockedReason && phase === 'PHASE_4_IMPLEMENT'
            ? 'blocked'
            : implementationDone
              ? 'passed'
              : phase === 'PHASE_4_IMPLEMENT'
                ? 'current'
                : specApproved
                  ? 'pending'
                  : 'pending',
        owner: 'claude-code',
        humanGate: 'none',
        phase: 'PHASE_4_IMPLEMENT',
        evidenceTypes: ['implementation-record', 'shards'],
        evidenceIds: [...evidenceByKind('implementation-record'), ...evidenceByKind('shards')],
        blockedReason: blockedReason && phase === 'PHASE_4_IMPLEMENT' ? blockedReason : undefined,
      },
      {
        id: `${item.issue.id}-code-review`,
        kind: 'code_review',
        label: 'Code Review',
        required: true,
        status: blockedReason
          ? 'blocked'
          : reviewPassed
            ? 'passed'
            : phase === 'PHASE_5_REVIEW' || phase === 'PHASE_6_CONVERGE'
              ? 'current'
              : implementationDone
                ? 'pending'
                : 'pending',
        owner: 'codex',
        humanGate: 'none',
        phase: 'PHASE_5_REVIEW',
        evidenceTypes: ['review-record', 'global-review', 'test-record'],
        evidenceIds: [
          ...evidenceByKind('review-record'),
          ...evidenceByKind('global-review'),
          ...evidenceByKind('test-record'),
        ],
        blockedReason,
      },
      {
        id: `${item.issue.id}-browser-qa`,
        kind: 'browser_qa',
        label: 'Browser QA',
        required: false,
        status: browserQaPassed
          ? 'passed'
          : phase === 'PHASE_7_GLOBAL_REVIEW'
            ? 'current'
            : 'pending',
        owner: 'codex',
        humanGate: 'none',
        phase: 'PHASE_7_GLOBAL_REVIEW',
        evidenceTypes: ['global-review'],
        evidenceIds: evidenceByKind('global-review'),
      },
      {
        id: `${item.issue.id}-release-gate`,
        kind: 'release_gate',
        label: 'Release Gate',
        required: true,
        status: blockedReason
          ? 'blocked'
          : releaseReady
            ? 'passed'
            : ['PHASE_6_CONVERGE', 'PHASE_7_GLOBAL_REVIEW', 'PHASE_8_ANNOTATE', 'CLOSED'].includes(
                  phase,
                )
              ? 'current'
              : 'pending',
        owner: 'codex',
        humanGate: 'decision',
        phase: 'PHASE_8_ANNOTATE',
        evidenceTypes: ['convergence-pr', 'annotations'],
        evidenceIds: [...evidenceByKind('convergence-pr'), ...evidenceByKind('annotations')],
        blockedReason,
      },
      {
        id: `${item.issue.id}-retro`,
        kind: 'retro',
        label: 'Reflect',
        required: false,
        status: item.issue.status === 'ARCHIVED' ? 'passed' : releaseReady ? 'current' : 'pending',
        owner: 'codex',
        humanGate: 'none',
        evidenceTypes: ['annotations'],
        evidenceIds: evidenceByKind('annotations'),
      },
    ];

    return {
      id: snapshot?.id ?? workflowDefault?.recipeId ?? `default-${this.inferWorkflowKind(item)}`,
      name: snapshot?.name ?? 'Default Codex / Claude Code delivery',
      version: snapshot?.version ?? 1,
      appliesTo: snapshot?.appliesTo ?? [this.inferWorkflowKind(item)],
      capturedAt: snapshot?.capturedAt ?? workflowDefault?.updated ?? updated,
      source: snapshot?.source ?? (workflowDefault ? 'workspace' : 'default'),
      baselineEvidence:
        snapshot?.baselineEvidence ?? this.buildWorkflowBaselineEvidence(item, workflowDefault),
      steps,
    };
  }

  buildReleaseGate(item: DeliveryControlInput, secondOpinion?: LoopSecondOpinion): LoopReleaseGate {
    const updated = item.state?.updated ?? item.issue.updated;
    const evidenceByKind = this.evidenceIdsByKind(item);
    const detail = this.asDetail(item);
    const governance = detail?.deliveryGovernance;
    const reviewGates = this.buildReviewGates(item);
    const canaryPassed = !governance?.releaseCanary || governance.releaseCanary.status === 'passed';
    const checklist = {
      specApproved: this.isSpecApproved(item),
      implementationEvidence: this.isImplementationDone(item),
      testsPassed: this.testsPassed(item),
      requiredReviewsPassed: reviewGates.every(
        (gate) => gate.status === 'passed' || gate.status === 'waived',
      ),
      secondOpinionPassed: secondOpinion
        ? !secondOpinion.requiredForRelease || secondOpinion.status === 'passed'
        : true,
      browserQaPassed: this.isBrowserQaPassed(item),
      docsUpdated: true,
      prReady: Boolean(detail?.convergencePr || item.issue.status === 'CLOSED'),
      rollbackNote: Boolean(
        detail?.convergencePr ||
        item.issue.status === 'CLOSED' ||
        governance?.releaseCanary?.rollbackNote,
      ),
      canaryPassed,
    };
    const blocker = this.deliveryBlockedReason(item);
    return {
      id: `${item.issue.id}-release-gate`,
      status: blocker
        ? 'blocked'
        : item.issue.status === 'CLOSED' || item.state?.finalized
          ? 'shipped'
          : Object.values(checklist).every(Boolean)
            ? 'ready'
            : 'pending',
      checklist,
      evidenceIds: [
        ...evidenceByKind('spec'),
        ...evidenceByKind('implementation-record'),
        ...evidenceByKind('test-record'),
        ...evidenceByKind('review-record'),
        ...evidenceByKind('global-review'),
        ...evidenceByKind('convergence-pr'),
      ],
      blocker,
      updated,
    };
  }

  buildDeliveryControls(
    item: DeliveryControlInput,
    secondOpinion?: LoopSecondOpinion,
  ): {
    workflowRecipe: LoopWorkflowRecipe;
    reviewGates: LoopReviewGate[];
    releaseGate: LoopReleaseGate;
    secondOpinion?: LoopSecondOpinion;
  } {
    return {
      workflowRecipe: this.buildWorkflowRecipe(item),
      reviewGates: this.buildReviewGates(item),
      releaseGate: this.buildReleaseGate(item, secondOpinion),
      ...(secondOpinion ? { secondOpinion } : {}),
    };
  }

  withRequirementsCoverage<T extends RequirementsCoverageEnricherInput>(
    detail: T,
    secondOpinion?: LoopSecondOpinion,
  ): T & {
    requirementsCoverage: LoopRequirementCoverage;
    evidenceArtifacts: LoopEvidenceArtifact[];
  } {
    const evidenceArtifacts = this.buildEvidenceArtifacts(detail);
    const enhanced = {
      ...detail,
      requirementsCoverage: this.buildRequirementsCoverage(detail),
      evidenceArtifacts,
    };
    return {
      ...enhanced,
      ...this.buildDeliveryControls(enhanced, secondOpinion),
    };
  }

  async withDeliveryControlsList<T extends LoopListResponse>(
    result: T,
    input: {
      readDetail: (issueId: string) => Promise<DeliveryControlsListDetail>;
      buildSecondOpinion?: (detail: DeliveryControlsListDetail) => LoopSecondOpinion;
      onReadError?: (issueId: string, error: unknown) => void;
    },
  ): Promise<T> {
    const list = await Promise.all(
      result.list.map(async (item) => {
        let runtimeSecurityExceptions: LoopRuntimeSecurityException[] = [];
        let deliveryItem: DeliveryControlsListItem | DeliveryControlsListDetail =
          item as DeliveryControlsListItem;
        try {
          const detail = await input.readDetail(item.issue.id);
          deliveryItem = detail;
          runtimeSecurityExceptions = this.buildRuntimeSecurityExceptions(detail);
        } catch (error) {
          input.onReadError?.(item.issue.id, error);
        }
        const detail = this.isDeliveryControlsListDetail(deliveryItem) ? deliveryItem : undefined;
        const secondOpinion =
          detail && input.buildSecondOpinion ? input.buildSecondOpinion(detail) : undefined;
        return {
          ...item,
          ...this.buildDeliveryControls(deliveryItem, secondOpinion),
          ...(detail?.deliveryGovernance ? { deliveryGovernance: detail.deliveryGovernance } : {}),
          ...(runtimeSecurityExceptions.length ? { runtimeSecurityExceptions } : {}),
        };
      }),
    );
    return {
      ...result,
      list,
    };
  }

  private asDetail(item: DeliveryControlInput): DeliveryControlInput | undefined {
    return 'intake' in item ? item : undefined;
  }

  private isDeliveryControlsListDetail(
    item: DeliveryControlsListItem | DeliveryControlsListDetail,
  ): item is DeliveryControlsListDetail {
    return 'intake' in item;
  }
}
