import { Injectable } from '@nestjs/common';
import type {
  LoopAnnotation,
  LoopConvergencePr,
  LoopGlobalReviewRecord,
  LoopIssue,
  LoopShard,
  LoopSpec,
  LoopTestMatrix,
  LoopTestRecord,
} from '@repo/contracts';
import type {
  LoopsAgentAdapter,
  LoopsDecomposition,
  LoopsGlobalReviewInput,
  LoopsReviewInput,
  LoopsReviewOutput,
  LoopsTestReviewOutput,
} from './loops-agent-adapter.interface';

/**
 * 确定性 Codex 大脑实现（默认）。
 *
 * 不调用真实 `codex` CLI，以可复现的 MVP 模板产出 Spec / Shard / Test Matrix / 审查结论，
 * 让 Loop 在无 agent CLI 的环境下也能端到端跑通收敛逻辑。真实 CLI 见 `CliLoopsAgentAdapter`。
 */
@Injectable()
export class DeterministicLoopsAgentAdapter implements LoopsAgentAdapter {
  async plan(issue: LoopIssue, createdAt: string): Promise<LoopSpec> {
    return {
      id: `spec-${issue.id.replace('issue-', '')}`,
      issueId: issue.id,
      version: 'v1',
      status: 'DRAFT',
      created: createdAt,
      contextBudget: 24000,
      body: this.renderSpec(issue, createdAt),
    };
  }

  async decompose(issue: LoopIssue, spec: LoopSpec): Promise<LoopsDecomposition> {
    const shards = this.createMvpShards(issue, spec);
    return {
      shards,
      annotations: this.createInitialAnnotations(issue, spec, shards),
    };
  }

  async designTests(
    issue: LoopIssue,
    spec: LoopSpec,
    shards: LoopShard[],
    createdAt: string,
  ): Promise<LoopTestMatrix> {
    return this.deriveTestMatrix(issue, spec, shards, createdAt);
  }

  async reviewTests(input: {
    matrix?: LoopTestMatrix;
    testRecord?: LoopTestRecord;
  }): Promise<LoopsTestReviewOutput> {
    const record = input.testRecord;
    if (!record) {
      return {
        testVerdict: 'TEST-MISSING',
        issues: [{ severity: 'major', desc: '缺少本轮 Test Record，无法判定测试状态。' }],
        fixInstructions: ['运行 shard 测试命令并产出 Test Record 后再审查。'],
        summary: 'No test record for this round.',
      };
    }
    if (record.status === 'TEST-PASS') {
      return {
        testVerdict: 'TEST-PASS',
        issues: [],
        fixInstructions: [],
        summary: 'All configured test commands passed.',
      };
    }
    return {
      testVerdict: record.status,
      issues: record.failedTests.map((item) => ({ severity: 'major' as const, desc: item.reason })),
      fixInstructions: record.fixInstructions,
      summary: `${record.failedTests.length} test command(s) failed.`,
    };
  }

  async review(input: LoopsReviewInput): Promise<LoopsReviewOutput> {
    const { shard, implementationRecord, testRecord } = input;
    const testsPass = testRecord?.status === 'TEST-PASS';
    const covered = shard.acceptance.every((item) =>
      implementationRecord.summary.toLowerCase().includes(item.toLowerCase().slice(0, 12)) ||
      implementationRecord.changedFiles.length > 0,
    );
    if (testsPass && covered) {
      return {
        verdict: 'PASS',
        issues: [],
        fixInstructions: [],
        summary: '实现满足验收标准且本轮测试通过。',
      };
    }
    return {
      verdict: 'NEEDS-WORK',
      issues: [
        {
          severity: 'major',
          desc: testsPass
            ? '实现尚未覆盖全部验收标准，需补齐。'
            : '本轮测试未通过或缺失，需修复并重跑。',
        },
      ],
      fixInstructions: testsPass
        ? ['对照 acceptance 逐条补齐实现并重新登记 Implementation Record。']
        : [...(testRecord?.fixInstructions ?? ['修复失败测试后重新运行 shard tests。'])],
      summary: 'Needs revision: acceptance or tests incomplete.',
    };
  }

  async reviewGlobal(input: LoopsGlobalReviewInput): Promise<LoopsReviewOutput> {
    const allDone = input.shards.length > 0 && input.shards.every((shard) => shard.status === 'DONE');
    const testsPass = input.testRecords.every((record) => record.status === 'TEST-PASS');
    const hasRecords = input.implementationRecords.length > 0 && input.reviewRecords.length > 0;

    if (allDone && testsPass && hasRecords) {
      return {
        verdict: 'PASS',
        issues: [],
        fixInstructions: [],
        summary: '所有 Shard 已 DONE、测试通过、记录齐备，整体一致。',
      };
    }
    return {
      verdict: 'NEEDS-WORK',
      issues: [
        {
          severity: allDone ? 'minor' : 'major',
          desc: allDone
            ? '存在未通过的测试或缺失的实施/审查记录，需补齐后再次整体复查。'
            : '仍有未完成的 Shard，需先推动到全部 DONE 再做整体复查。',
        },
      ],
      fixInstructions: allDone
        ? ['补齐缺失的测试/实施/审查记录后重新整体复查。']
        : ['回到 Phase 4 继续推动剩余 Shard，直到全部 DONE。'],
      summary: 'Not yet converged: pending shards or missing evidence.',
    };
  }

  async annotateFinalize(input: {
    issue: LoopIssue;
    spec?: LoopSpec;
    shards: LoopShard[];
    annotations: LoopAnnotation[];
    globalVerdict: 'PASS' | 'NEEDS-WORK' | 'FAIL';
    testMatrix?: LoopTestMatrix;
    globalReview?: LoopGlobalReviewRecord;
    convergencePr?: LoopConvergencePr;
  }): Promise<LoopAnnotation[]> {
    const passed = input.globalVerdict === 'PASS';
    const refreshed = input.annotations.map((annotation) => {
      const isShard = input.shards.some((shard) => shard.id === annotation.target);
      const isSpec = input.spec?.id === annotation.target;
      const isIssue = input.issue.id === annotation.target;
      return {
        ...annotation,
        annotator: 'codex' as const,
        implStatus: passed ? ('done' as const) : annotation.implStatus,
        testStatus: passed ? ('pass' as const) : annotation.testStatus,
        verdict: passed
          ? ('pass' as const)
          : annotation.verdict === 'unreviewed'
            ? ('needs-work' as const)
            : annotation.verdict,
        coverage: passed ? ('full' as const) : annotation.coverage,
        notes:
          passed && (isShard || isSpec || isIssue)
            ? `终态标注：已收敛，实现/测试/审查均通过。${annotation.notes ? ` ${annotation.notes}` : ''}`
            : annotation.notes,
      };
    });
    const existingTargets = new Set(refreshed.map((annotation) => annotation.target));
    const finalAnnotations: LoopAnnotation[] = [...refreshed];

    if (passed && input.testMatrix && !existingTargets.has(input.testMatrix.id)) {
      finalAnnotations.push(this.finalAnnotation(input.testMatrix.id, input.issue.id, [
        `.loops/tests/${input.issue.id}/matrix.json`,
        `.loops/tests/${input.issue.id}/matrix.md`,
      ], 'Test Matrix 已随收敛终态确认。'));
    }

    if (passed && input.globalReview && !existingTargets.has(input.globalReview.id)) {
      finalAnnotations.push(this.finalAnnotation(input.globalReview.id, input.issue.id, [
        `.loops/runs/${input.issue.id}/global-review.json`,
        `.loops/runs/${input.issue.id}/global-review.md`,
      ], 'Global Review 已 PASS 并纳入终态标注。'));
    }

    if (passed && input.convergencePr && !existingTargets.has(input.convergencePr.id)) {
      finalAnnotations.push(this.finalAnnotation(input.convergencePr.id, input.issue.id, [
        `.loops/runs/${input.issue.id}/convergence-pr.json`,
        `.loops/runs/${input.issue.id}/convergence-pr.md`,
      ], 'Convergence PR 记录已生成并纳入终态标注。'));
    }

    return finalAnnotations;
  }

  private finalAnnotation(
    target: string,
    issueId: string,
    location: string[],
    notes: string,
  ): LoopAnnotation {
    return {
      target,
      annotator: 'codex',
      round: 1,
      implStatus: 'done',
      testStatus: 'pass',
      verdict: 'pass',
      coverage: 'full',
      location,
      risk: 'low',
      notes: `终态标注：${notes} issue=${issueId}`,
    };
  }

  private renderSpec(issue: LoopIssue, createdAt: string) {
    const checklist = issue.acceptanceCriteria
      .map((item) => `- [ ] ${item} [impl:not-started test:not-run verdict:unreviewed]`)
      .join('\n');
    return `---\nid: spec-${issue.id.replace('issue-', '')}\nissue: ${issue.id}\nversion: v1\nstatus: DRAFT\ncreated: ${createdAt}\ncontext_budget: 24000\nannotation:\n  impl_status: not-started\n  test_status: not-run\n  verdict: unreviewed\n  coverage: none\n  risk: medium\n---\n\n## 背景与目标\n${issue.body}\n\n## 范围（含明确的不做项）\n- 覆盖目标仓库：${issue.targetRepo}\n- MVP 先落 Web Issue、人工审核、基础拆解、状态与标注，不启动真实 agent 长任务。\n\n## 方案设计\n- 使用 .loops 文件作为状态真相源。\n- 通过 Web 表单创建 IssueIntake 与 Issue。\n- Spec 审核通过后生成串行 MVP Shards。\n\n## 验收标准（可勾选清单）\n${checklist}\n\n## 测试策略（单元 / 集成 / E2E / 回归 / 人工验收）\n- unit: 校验表单 schema 与文件状态写入。\n- integration: 校验 issue -> spec -> review -> decompose 流转。\n- e2e: MVP 暂标记 manual/deferred。\n- regression: pnpm lint / pnpm type-check。\n\n## 风险与依赖\n- 真实 Codex/Claude Code 非交互调用仍需 Adapter 版本核对。\n- Dofe SSO 当前使用 mock user 能力，真实校验后续接入。\n\n## 拆解指引（给 Codex 拆解阶段的提示）\n按 contract、API、Web 控制台、标注与恢复能力拆分，每个 Shard 保持 est_context < 24000。\n`;
  }

  private createMvpShards(issue: LoopIssue, spec: LoopSpec): LoopShard[] {
    return [
      {
        id: `${issue.id}-shard-1`,
        specId: spec.id,
        title: '实现 Loops Web Issue 与文件真相源',
        status: 'TODO',
        priority: issue.priority,
        dependsOn: [],
        estContext: 9000,
        estEffort: 'M',
        acceptance: [
          '能记录 source_channel=web、submitter、raw_payload_ref',
          '能写入 .loops/issues、.loops/intakes、state.json、log.jsonl',
        ],
        testRequirements: {
          unit: ['覆盖 CreateLoopIssueRequestSchema 必填校验'],
          integration: ['覆盖 POST /loops/issues 创建完整状态文件'],
          e2e: ['页面提交 Issue 后能进入详情页（manual/deferred）'],
        },
        filesHint: [
          'packages/contracts/src/schemas/loops.schema.ts',
          'apps/api/src/modules/loops/*',
          'apps/web/app/loops/*',
        ],
      },
      {
        id: `${issue.id}-shard-2`,
        specId: spec.id,
        title: '实现 Spec 审核门禁与基础拆解',
        status: 'TODO',
        priority: issue.priority,
        dependsOn: [`${issue.id}-shard-1`],
        estContext: 8500,
        estEffort: 'M',
        acceptance: [
          '未经 APPROVED 的 Spec 不允许 decompose',
          '审核通过后生成自包含 Shards 与基础 Annotation',
        ],
        testRequirements: {
          unit: ['覆盖 reviewSpec action 状态映射'],
          integration: ['覆盖 generateSpec -> approve -> decompose 流转'],
          e2e: ['审核台通过后 Loop 进度页展示 shard 列表（manual/deferred）'],
        },
        filesHint: [
          'apps/api/src/modules/loops/loops.service.ts',
          'apps/web/app/loops/[issueId]/page.tsx',
        ],
      },
    ];
  }

  private createInitialAnnotations(
    issue: LoopIssue,
    spec: LoopSpec,
    shards: LoopShard[],
  ): LoopAnnotation[] {
    return [
      {
        target: issue.id,
        annotator: 'system',
        round: 1,
        implStatus: 'in-progress',
        testStatus: 'not-run',
        verdict: 'unreviewed',
        coverage: 'partial',
        location: ['.loops/issues', '.loops/intakes'],
        risk: 'medium',
        notes: 'MVP Issue Intake 已归一化，真实 SSO 与 agent 调用仍待接入。',
      },
      {
        target: spec.id,
        annotator: 'system',
        round: 1,
        implStatus: 'in-progress',
        testStatus: 'not-run',
        verdict: 'pass',
        coverage: 'partial',
        location: ['.loops/specs'],
        risk: 'medium',
        notes: 'Spec 已通过人工门禁并进入基础拆解。',
      },
      ...shards.map((shard) => ({
        target: shard.id,
        annotator: 'system' as const,
        round: 1,
        implStatus: 'not-started' as const,
        testStatus: 'missing' as const,
        verdict: 'unreviewed' as const,
        coverage: 'partial' as const,
        location: shard.filesHint,
        risk: 'medium' as const,
        notes: 'Shard 已生成，等待真实 Runner/Claude Code 实施与测试证据。',
      })),
    ];
  }

  private deriveTestMatrix(
    issue: LoopIssue,
    spec: LoopSpec,
    shards: LoopShard[],
    createdAt: string,
  ): LoopTestMatrix {
    const requiredTests = shards.flatMap((shard) => {
      const unit = shard.testRequirements.unit.map((title, index) => ({
        id: `${shard.id}-unit-${index + 1}`,
        shardId: shard.id,
        level: 'unit' as const,
        title,
        command: 'pnpm test',
        required: true,
      }));
      const integration = shard.testRequirements.integration.map((title, index) => ({
        id: `${shard.id}-integration-${index + 1}`,
        shardId: shard.id,
        level: 'integration' as const,
        title,
        command: 'pnpm test',
        required: true,
      }));
      const e2e = shard.testRequirements.e2e.map((title, index) => ({
        id: `${shard.id}-e2e-${index + 1}`,
        shardId: shard.id,
        level: 'e2e' as const,
        title,
        command: 'pnpm test',
        required: true,
      }));
      const manual = shard.acceptance.map((title, index) => ({
        id: `${shard.id}-manual-${index + 1}`,
        shardId: shard.id,
        level: 'manual' as const,
        title,
        required: true,
      }));
      return [...unit, ...integration, ...e2e, ...manual];
    });

    return {
      id: `test-matrix-${issue.id}`,
      issueId: issue.id,
      specId: spec.id,
      owner: 'codex',
      status: 'ACTIVE',
      created: createdAt,
      requiredTests,
      regressionScope: Array.from(new Set(shards.flatMap((shard) => shard.filesHint))),
      manualAcceptance: shards.flatMap((shard) => shard.acceptance),
    };
  }
}
