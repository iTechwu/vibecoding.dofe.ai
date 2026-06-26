import { Injectable } from '@nestjs/common';
import type {
  EvalHistoricalBaselineSnapshot,
  EvalRun,
  EvalSuite,
  LoopBenchMetricKey,
  LoopCostResponse,
  LoopLearning,
  LoopListResponse,
  LoopWorkflowRecipe,
} from '@repo/contracts';

type LoopListItem = LoopListResponse['list'][number];
type LoopDetailLike = {
  spec?: { status: string } | null;
  convergencePr?: { status: string } | null;
  workflowRecipe?: Pick<LoopWorkflowRecipe, 'baselineEvidence'>;
  testRecords: Array<{
    status: string;
    fixInstructions: unknown[];
    coverage?: unknown;
    runtimeSecurityPolicy?: {
      write: { scope: string };
      network: { status: string };
      canary: { status: string };
    };
  }>;
  implementationRecords: Array<{ durationSec?: number }>;
};
type EvalCheckBlueprint = Omit<
  EvalSuite['checks'][number],
  'passCount' | 'failCount' | 'blockedCount'
>;
type EvalSuiteBlueprint = Omit<EvalSuite, 'capturedAt' | 'checks' | 'summary'> & {
  checks: EvalCheckBlueprint[];
};
type EvalEvidence = {
  list: LoopListItem[];
  details: Map<string, LoopDetailLike>;
  costByIssue: Map<string, LoopCostResponse['loops'][number]>;
};
type EvalRunBuildContext = {
  history?: EvalHistoricalBaselineSnapshot[];
  inferWorkflowKind?: (item: LoopListItem) => string;
};

/**
 * Loops Eval domain service — `@app/services/loops-eval`.
 *
 * Step 6：承接 eval suite/run/bench 的纯 builder。当前先下沉 suite 构建逻辑，
 * evidence collection / HTTP exception 映射仍由 API facade 负责。
 */
@Injectable()
export class LoopsEvalService {
  buildEvalSuites(evidence: EvalEvidence): EvalSuite[] {
    const now = new Date().toISOString();
    return this.evalSuiteBlueprints().map((suite) =>
      this.materializeEvalSuite(suite, evidence, now),
    );
  }

  evalSuiteBlueprints(): EvalSuiteBlueprint[] {
    return [
      {
        id: 'architecture-compliance',
        name: 'Architecture Compliance',
        scope: 'workspace' as const,
        version: 1,
        checks: [
          {
            id: 'db-service-layer',
            label: 'DB access only in DB Service',
            category: 'architecture' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Derived from cross-loop review',
          },
          {
            id: 'zod-contract',
            label: 'Zod-first contract validation',
            category: 'architecture' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Contracts exist for all API endpoints',
          },
          {
            id: 'client-layer',
            label: 'External API via Client layer',
            category: 'architecture' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Client imports verified',
          },
          {
            id: 'winston-logger',
            label: 'Winston Logger (no console.log)',
            category: 'architecture' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Logger injection verified',
          },
        ],
      },
      {
        id: 'delivery-readiness',
        name: 'Delivery Readiness',
        scope: 'delivery' as const,
        version: 1,
        checks: [
          {
            id: 'spec-approved',
            label: 'Spec approved',
            category: 'delivery' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Spec status per loop',
          },
          {
            id: 'global-review-pass',
            label: 'Global review pass',
            category: 'delivery' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Global verdict per loop',
          },
          {
            id: 'pr-evidence',
            label: 'PR evidence present',
            category: 'delivery' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Convergence PR status',
          },
        ],
      },
      {
        id: 'runtime-safety',
        name: 'Runtime Safety',
        scope: 'runtime' as const,
        version: 1,
        checks: [
          {
            id: 'path-policy',
            label: 'Path policy enforced',
            category: 'runtime' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Path policy snapshots',
          },
          {
            id: 'network-policy',
            label: 'Network policy',
            category: 'runtime' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Network strategy per workspace',
          },
          {
            id: 'secret-canary',
            label: 'Secret canary detection',
            category: 'runtime' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Canary status per test record',
          },
        ],
      },
      {
        id: 'test-evidence',
        name: 'Test Evidence',
        scope: 'delivery' as const,
        version: 1,
        checks: [
          {
            id: 'test-command-pass',
            label: 'Required tests pass',
            category: 'test' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Test records per loop',
          },
          {
            id: 'failure-classified',
            label: 'Failure reason classified',
            category: 'test' as const,
            hardGate: false,
            status: 'attention' as const,
            evidence: 'Test record fix instructions',
          },
          {
            id: 'coverage-exists',
            label: 'Coverage reported',
            category: 'test' as const,
            hardGate: false,
            status: 'attention' as const,
            evidence: 'Coverage data per test record',
          },
        ],
      },
      {
        id: 'cost-policy',
        name: 'Cost Policy',
        scope: 'agent' as const,
        version: 1,
        checks: [
          {
            id: 'token-budget',
            label: 'Token budget not exceeded',
            category: 'cost' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Cost guard state',
          },
          {
            id: 'call-budget',
            label: 'Call budget not exceeded',
            category: 'cost' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Cost guard state',
          },
          {
            id: 'time-budget',
            label: 'Time budget not exceeded',
            category: 'cost' as const,
            hardGate: false,
            status: 'attention' as const,
            evidence: 'Not yet tracked per-loop',
          },
        ],
      },
    ];
  }

  materializeEvalSuite(
    suite: EvalSuiteBlueprint,
    evidence: EvalEvidence,
    capturedAt: string,
  ): EvalSuite {
    const checks = suite.checks.map((check) => {
      const results = evidence.list.map((item) => this.evaluateEvalCheck(check.id, item, evidence));
      const passCount = results.filter((status) => status === 'passed').length;
      const failCount = results.filter((status) => status === 'attention').length;
      const blockedCount = results.filter((status) => status === 'blocked').length;
      return {
        ...check,
        status: this.evalAggregateStatus(passCount, failCount, blockedCount),
        passCount,
        failCount,
        blockedCount,
      };
    });
    const passed = checks.filter((check) => check.status === 'passed').length;
    const attention = checks.filter((check) => check.status === 'attention').length;
    const blocked = checks.filter((check) => check.status === 'blocked').length;
    return {
      ...suite,
      capturedAt,
      checks,
      summary: {
        total: checks.length,
        passed,
        attention,
        blocked,
        passRate: checks.length ? Math.round((passed / checks.length) * 100) : 0,
      },
    };
  }

  evaluateEvalCheck(
    checkId: string,
    item: LoopListItem,
    evidence: EvalEvidence,
  ): EvalSuite['checks'][number]['status'] {
    const detail = evidence.details.get(item.issue.id);
    const costItem = evidence.costByIssue.get(item.issue.id);
    switch (checkId) {
      case 'db-service-layer':
      case 'zod-contract':
      case 'client-layer':
      case 'winston-logger':
        return item.state?.globalVerdict === 'FAIL' ? 'blocked' : 'attention';
      case 'spec-approved':
        return detail?.spec?.status === 'APPROVED'
          ? 'passed'
          : item.issue.status === 'REJECTED'
            ? 'blocked'
            : 'attention';
      case 'global-review-pass':
        return item.state?.globalVerdict === 'PASS'
          ? 'passed'
          : item.state?.globalVerdict === 'FAIL'
            ? 'blocked'
            : 'attention';
      case 'pr-evidence':
        return detail?.convergencePr?.status === 'OPENED' ||
          detail?.convergencePr?.status === 'PUSHED'
          ? 'passed'
          : item.state?.globalVerdict === 'FAIL'
            ? 'blocked'
            : 'attention';
      case 'path-policy':
        return detail?.testRecords.some(
          (record) => record.runtimeSecurityPolicy?.write.scope === 'target-repo',
        )
          ? 'passed'
          : item.state?.paused
            ? 'blocked'
            : 'attention';
      case 'network-policy':
        return detail?.testRecords.some(
          (record) => record.runtimeSecurityPolicy?.network.status === 'blocked',
        )
          ? 'passed'
          : detail?.testRecords.some(
                (record) => record.runtimeSecurityPolicy?.network.status === 'allowed-by-override',
              )
            ? 'blocked'
            : 'attention';
      case 'secret-canary':
        return detail?.testRecords.some(
          (record) => record.runtimeSecurityPolicy?.canary.status === 'leaked',
        )
          ? 'blocked'
          : detail?.testRecords.some(
                (record) => record.runtimeSecurityPolicy?.canary.status === 'armed',
              )
            ? 'passed'
            : 'attention';
      case 'test-command-pass':
        return !detail?.testRecords.length
          ? 'attention'
          : detail.testRecords.every((record) => record.status === 'TEST-PASS')
            ? 'passed'
            : detail.testRecords.some((record) => record.status === 'TEST-FAIL')
              ? 'blocked'
              : 'attention';
      case 'failure-classified':
        return !detail?.testRecords.length
          ? 'attention'
          : detail.testRecords.some(
                (record) => record.status === 'TEST-FAIL' && record.fixInstructions.length === 0,
              )
            ? 'blocked'
            : 'passed';
      case 'coverage-exists':
        return detail?.testRecords.some((record) => record.coverage) ? 'passed' : 'attention';
      case 'token-budget':
        return !costItem
          ? 'attention'
          : costItem.tokensRemaining < 0 || costItem.tripped
            ? 'blocked'
            : 'passed';
      case 'call-budget':
        return !costItem
          ? 'attention'
          : costItem.callsRemaining < 0 || costItem.tripped
            ? 'blocked'
            : 'passed';
      case 'time-budget':
        return detail?.implementationRecords.some(
          (record) => typeof record.durationSec === 'number',
        )
          ? 'passed'
          : 'attention';
      default:
        return 'attention';
    }
  }

  evalAggregateStatus(
    passCount: number,
    failCount: number,
    blockedCount: number,
  ): EvalSuite['checks'][number]['status'] {
    if (blockedCount > 0) return 'blocked';
    if (passCount > 0 && failCount === 0) return 'passed';
    return 'attention';
  }

  buildLoopBenchMetrics(
    items: LoopListItem[],
    options: {
      cost?: LoopCostResponse;
      recentLearnings?: LoopLearning[];
    } = {},
  ): Record<LoopBenchMetricKey, number> {
    const active = items.filter(
      ({ issue }) => !['CLOSED', 'ARCHIVED', 'REJECTED'].includes(issue.status),
    );
    const completed = items.filter(
      ({ issue, state }) =>
        issue.status === 'CLOSED' || state?.finalized || state?.phase === 'CLOSED',
    );
    const firstPassCount = completed.filter(
      ({ state }) => state?.globalVerdict === 'PASS' && (state.reloopCount ?? 0) === 0,
    ).length;
    const browserQaRegressionCount = active.filter(
      ({ releaseGate }) => releaseGate?.checklist.browserQaPassed === false,
    ).length;
    const secondOpinionConflictCount = active.filter(({ releaseGate, state }) => {
      const phase = state?.phase ?? 'PHASE_0_INTAKE';
      return (
        ['PHASE_6_CONVERGE', 'PHASE_7_GLOBAL_REVIEW', 'PHASE_8_ANNOTATE'].includes(phase) &&
        releaseGate?.checklist.secondOpinionPassed === false
      );
    }).length;
    const blockedCount = active.filter(
      ({ state }) => state?.paused || (state?.globalVerdict && state.globalVerdict !== 'PASS'),
    ).length;
    const costTripped = options.cost?.loops.filter((item) => item.tripped).length ?? 0;
    const violationCount = items.reduce(
      (sum, item) => sum + (item.runtimeSecurityExceptions?.length ?? 0),
      0,
    );
    const learnings = options.recentLearnings ?? [];
    const reusedCount = learnings.filter((learning) => learning.lastUsedAt).length;
    const canaryRuns = items.filter(
      ({ releaseGate }) => typeof releaseGate?.checklist.canaryPassed === 'boolean',
    );
    const canaryPassed = canaryRuns.filter(
      ({ releaseGate }) => releaseGate?.checklist.canaryPassed === true,
    ).length;

    return {
      firstPassReviewRate: this.percent(firstPassCount, completed.length),
      browserQaRegressionRate: this.percent(browserQaRegressionCount, active.length),
      secondOpinionConflictRate: this.percent(secondOpinionConflictCount, active.length),
      releaseBlockerRate: this.percent(blockedCount + costTripped, active.length),
      runtimeViolationRate: this.percent(violationCount, items.length),
      learningReuseRate: this.percent(reusedCount, learnings.length),
      canaryPassRate: this.percent(canaryPassed, canaryRuns.length),
    };
  }

  diffLoopBenchMetrics(
    current: Record<LoopBenchMetricKey, number>,
    previous: Record<LoopBenchMetricKey, number>,
  ): Record<LoopBenchMetricKey, number> {
    return {
      firstPassReviewRate: current.firstPassReviewRate - previous.firstPassReviewRate,
      browserQaRegressionRate: current.browserQaRegressionRate - previous.browserQaRegressionRate,
      secondOpinionConflictRate:
        current.secondOpinionConflictRate - previous.secondOpinionConflictRate,
      releaseBlockerRate: current.releaseBlockerRate - previous.releaseBlockerRate,
      runtimeViolationRate: current.runtimeViolationRate - previous.runtimeViolationRate,
      learningReuseRate: current.learningReuseRate - previous.learningReuseRate,
      canaryPassRate: current.canaryPassRate - previous.canaryPassRate,
    };
  }

  percent(numerator: number, denominator: number): number {
    return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  }

  buildEvalRuns(
    evidence: EvalEvidence,
    suites: EvalSuite[],
    query: { suiteId?: string; loopId?: string } = {},
    context: EvalRunBuildContext = {},
  ): EvalRun[] {
    const runs: EvalRun[] = [];
    for (const item of evidence.list) {
      for (const suite of suites) {
        if (query.suiteId && suite.id !== query.suiteId) continue;
        if (query.loopId && item.issue.id !== query.loopId) continue;
        const now = new Date().toISOString();
        const blueprintId = this.evalBlueprintId(item, evidence, context.inferWorkflowKind);
        const baseline = this.latestEvalBaseline(context.history ?? [], suite.id, blueprintId);
        const checkResults = suite.checks.map((check) => {
          const status = this.evaluateEvalCheck(check.id, item, evidence);
          return {
            ...check,
            status,
            passCount: status === 'passed' ? 1 : 0,
            failCount: status === 'attention' ? 1 : 0,
            blockedCount: status === 'blocked' ? 1 : 0,
          };
        });
        const passed = checkResults.filter((check) => check.status === 'passed').length;
        const blocked = checkResults.filter((check) => check.status === 'blocked').length;
        const score = Math.round((passed / Math.max(checkResults.length, 1)) * 100);
        const status: EvalRun['status'] =
          blocked > 0 ? 'blocked' : score >= 80 ? 'passed' : 'attention';
        runs.push({
          id: `eval-run-${suite.id}-${item.issue.id}`,
          suiteId: suite.id,
          loopId: item.issue.id,
          targetRef: item.issue.id,
          blueprintId,
          baselineVersion: baseline?.baselineVersion,
          baselineScore: baseline?.averageScore,
          status,
          score,
          checkResults,
          evidenceRefs: item.issue.id ? [`.loops/issues/${item.issue.id}.json`] : [],
          trendDelta:
            baseline?.averageScore === undefined ? undefined : score - baseline.averageScore,
          runAt: now,
        });
      }
    }
    return runs;
  }

  evalBlueprintId(
    item: LoopListItem,
    evidence: EvalEvidence,
    inferWorkflowKind?: (item: LoopListItem) => string,
  ): string {
    const detail = evidence.details.get(item.issue.id);
    const blueprint = detail?.workflowRecipe?.baselineEvidence?.find(
      (entry) => entry.kind === 'blueprint',
    );
    return blueprint?.value ?? inferWorkflowKind?.(item) ?? 'default';
  }

  latestEvalBaseline(
    history: EvalHistoricalBaselineSnapshot[],
    suiteId: string,
    blueprintId: string,
  ): EvalHistoricalBaselineSnapshot | undefined {
    return history
      .filter((item) => item.suiteId === suiteId && item.blueprintId === blueprintId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
  }

  evalBaselineVersion(blueprintId: string, suiteId: string, capturedAt: string): string {
    return `${this.safeId(blueprintId)}:${suiteId}:${capturedAt}`;
  }

  roundAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  safeId(value: string): string {
    return value.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'default';
  }

  buildEvalTrendBaselines(input: {
    runs: EvalRun[];
    history: EvalHistoricalBaselineSnapshot[];
    generatedAt: string;
  }): EvalHistoricalBaselineSnapshot[] {
    const grouped = new Map<string, EvalRun[]>();

    for (const run of input.runs) {
      const blueprintId = run.blueprintId ?? 'default';
      const key = `${blueprintId}:${run.suiteId}`;
      grouped.set(key, [...(grouped.get(key) ?? []), run]);
    }

    const baselines: EvalHistoricalBaselineSnapshot[] = [];
    for (const [key, group] of grouped.entries()) {
      const [blueprintId, suiteId] = key.split(':');
      const previous = this.latestEvalBaseline(input.history, suiteId, blueprintId);
      const averageScore = this.roundAverage(group.map((run) => run.score));
      const passed = group.filter((run) => run.status === 'passed').length;
      const passRate = group.length ? Math.round((passed / group.length) * 100) : 0;
      baselines.push({
        id: `eval-baseline-${this.safeId(blueprintId)}-${suiteId}-${Date.parse(input.generatedAt)}`,
        suiteId,
        blueprintId,
        baselineVersion: this.evalBaselineVersion(blueprintId, suiteId, input.generatedAt),
        capturedAt: input.generatedAt,
        runCount: group.length,
        averageScore,
        passRate,
        previousAverageScore: previous?.averageScore,
        trendDelta:
          previous?.averageScore === undefined ? undefined : averageScore - previous.averageScore,
      });
    }

    return baselines;
  }

  buildRequestTimeAggregation(input: {
    tenantId: string;
    suiteId?: string;
    period: '7d' | '30d' | '90d' | 'all';
    blueprintId?: string;
    page: number;
    limit: number;
    suites: EvalSuite[];
    capturedAt?: string;
  }): {
    aggregations: Array<{
      id: string;
      tenantId: string;
      workspaceId: string;
      suiteId: string;
      blueprintId?: string;
      totalChecks: number;
      passedChecks: number;
      failedChecks: number;
      blockedChecks: number;
      passRate: number;
      averageScore: number;
      loopCount: number;
      period: '7d' | '30d' | '90d' | 'all';
      capturedAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
    source: 'request-time';
  } {
    const capturedAt = input.capturedAt ?? new Date().toISOString();
    const suites = input.suites.filter((suite) => !input.suiteId || suite.id === input.suiteId);
    const aggs = suites.map((suite) => ({
      id: `${input.tenantId}-${suite.id}-${input.period}`,
      tenantId: input.tenantId,
      workspaceId: 'default',
      suiteId: suite.id,
      blueprintId: input.blueprintId,
      totalChecks: suite.summary.total,
      passedChecks: suite.summary.passed,
      failedChecks: suite.summary.attention,
      blockedChecks: suite.summary.blocked,
      passRate: suite.summary.passRate,
      averageScore: suite.summary.passRate,
      loopCount: suite.summary.total > 0 ? Math.max(1, Math.round(suite.summary.total / 3)) : 0,
      period: input.period,
      capturedAt,
    }));

    const paged = aggs.slice((input.page - 1) * input.limit, input.page * input.limit);
    return {
      aggregations: paged,
      total: aggs.length,
      page: input.page,
      limit: input.limit,
      source: 'request-time',
    };
  }
}
