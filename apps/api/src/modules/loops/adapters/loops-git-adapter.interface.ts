import type {
  LoopAnnotation,
  LoopConvergencePr,
  LoopEvidenceArtifact,
  LoopIssue,
  LoopShard,
} from '@repo/contracts';

/**
 * Git Adapter（07 §9 / ADR-008：commit-per-shard + 收敛 PR）。
 *
 * 每个 Shard 审查 PASS 转 DONE 时产生一次提交（commit message 关联 shard-id）；
 * Loop 收敛后聚合本 Loop 所有 shard commit，产出收敛 PR 描述（附标注摘要）。
 * 实现为真实 git CLI（`cli-loops-git.adapter.ts`），受 `config.git.commit_per_shard` 开关控制。
 */
export type LoopsCommitShardResult = {
  shardId: string;
  committed: boolean;
  message: string;
  branch?: string;
};

export type LoopsConvergencePrInput = {
  issue: LoopIssue;
  shards: LoopShard[];
  annotations: LoopAnnotation[];
  commits: LoopsCommitShardResult[];
  evidenceArtifacts?: LoopEvidenceArtifact[];
};

export interface LoopsGitAdapter {
  /** commit-per-shard：审查 PASS 转 DONE 后提交该 Shard 改动。 */
  commitShard(input: {
    issue: LoopIssue;
    shard: LoopShard;
    changedFiles: string[];
  }): Promise<LoopsCommitShardResult>;
  /** 收敛 PR：聚合本 Loop 所有 shard commit + 标注摘要，产出 PR 描述。 */
  createConvergencePr(input: LoopsConvergencePrInput): Promise<LoopConvergencePr>;
}

export const LOOPS_GIT_ADAPTER = Symbol('LOOPS_GIT_ADAPTER');
