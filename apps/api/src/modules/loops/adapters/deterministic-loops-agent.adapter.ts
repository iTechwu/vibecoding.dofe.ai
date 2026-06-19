import { Injectable } from '@nestjs/common';
import type { LoopAnnotation, LoopIssue, LoopShard, LoopSpec } from '@repo/contracts';
import type { LoopsAgentAdapter, LoopsDecomposition } from './loops-agent-adapter.interface';

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
          'apps/web/app/loops/reviews/page.tsx',
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
}
