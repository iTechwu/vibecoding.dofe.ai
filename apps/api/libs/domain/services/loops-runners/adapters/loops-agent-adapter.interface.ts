import type {
  LoopAnnotation,
  LoopConvergencePr,
  LoopGlobalReviewRecord,
  LoopImplementationRecord,
  LoopIssue,
  LoopReviewRecord,
  LoopShard,
  LoopSpec,
  LoopTestMatrix,
  LoopTestRecord,
} from '@repo/contracts';

/**
 * Codex 大脑 Adapter（07 §1 / 07 §2 六类调用）。
 *
 * 编排层只面对本接口，不感知 `codex` 命令行细节。默认实现为确定性 MVP；
 * 真实 headless CLI 实现见 `cli-loops-agent.adapter.ts`，由 DI 在启用时注入。
 */
export type LoopsDecomposition = {
  shards: LoopShard[];
  annotations: LoopAnnotation[];
};

export type LoopsReviewIssue = {
  severity: 'minor' | 'major' | 'critical';
  desc: string;
};

export type LoopsReviewOutput = {
  verdict: 'PASS' | 'NEEDS-WORK' | 'FAIL';
  issues: LoopsReviewIssue[];
  fixInstructions: string[];
  summary: string;
};

export type LoopsTestReviewOutput = {
  testVerdict: 'TEST-PASS' | 'TEST-MISSING' | 'TEST-FAIL' | 'TEST-FLAKY' | 'SKIPPED';
  issues: LoopsReviewIssue[];
  fixInstructions: string[];
  summary: string;
};

export type LoopsReviewInput = {
  shard: LoopShard;
  implementationRecord: LoopImplementationRecord;
  testRecord?: LoopTestRecord;
};

export type LoopsGlobalReviewInput = {
  issue: LoopIssue;
  spec?: LoopSpec;
  shards: LoopShard[];
  implementationRecords: LoopImplementationRecord[];
  reviewRecords: LoopReviewRecord[];
  testRecords: LoopTestRecord[];
  testMatrix?: LoopTestMatrix;
  annotations: LoopAnnotation[];
};

export interface LoopsAgentAdapter {
  /** 07 §2.2 ① plan：生成 Spec。 */
  plan(issue: LoopIssue, createdAt: string): Promise<LoopSpec>;
  /** 07 §2.2 ② decompose：拆解为自包含 Shard + 初始标注。 */
  decompose(issue: LoopIssue, spec: LoopSpec): Promise<LoopsDecomposition>;
  /** 07 §2.2 ③ designTests：生成 / 维护 Test Matrix。 */
  designTests(
    issue: LoopIssue,
    spec: LoopSpec,
    shards: LoopShard[],
    createdAt: string,
  ): Promise<LoopTestMatrix>;
  /** 07 §2.2 ④ reviewTests：基于测试证据判定测试状态。 */
  reviewTests(input: {
    matrix?: LoopTestMatrix;
    testRecord?: LoopTestRecord;
  }): Promise<LoopsTestReviewOutput>;
  /** 07 §2.2 ⑤ review：单 Shard 实现审查。 */
  review(input: LoopsReviewInput): Promise<LoopsReviewOutput>;
  /** 07 §2.2 ⑥ reviewGlobal：跨 Shard 整体复查。 */
  reviewGlobal(input: LoopsGlobalReviewInput): Promise<LoopsReviewOutput>;
  /** 07 §4/05 §4：标注（含终态标注）。 */
  annotateFinalize(input: {
    issue: LoopIssue;
    spec?: LoopSpec;
    shards: LoopShard[];
    annotations: LoopAnnotation[];
    globalVerdict: 'PASS' | 'NEEDS-WORK' | 'FAIL';
    testMatrix?: LoopTestMatrix;
    globalReview?: LoopGlobalReviewRecord;
    convergencePr?: LoopConvergencePr;
  }): Promise<LoopAnnotation[]>;
}

export const LOOPS_AGENT_ADAPTER = Symbol('LOOPS_AGENT_ADAPTER');
