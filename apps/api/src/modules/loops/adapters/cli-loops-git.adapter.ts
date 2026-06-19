import { Injectable } from '@nestjs/common';
import type { LoopConvergencePr } from '@repo/contracts';
import type {
  LoopsCommitShardResult,
  LoopsConvergencePrInput,
  LoopsGitAdapter,
} from './loops-git-adapter.interface';
import { runProcess } from './loops-process.util';
import { resolveAllowedTargetRepo } from '../loops-path-policy.util';

export type LoopsGitAdapterOptions = {
  commitPerShard: boolean;
  baseBranch: string;
};

/**
 * 真实 Git Adapter（07 §9 / ADR-008）。
 *
 * commit-per-shard：审查 PASS 转 DONE 时在 `loops/<issue-id>` 分支提交该 Shard 改动，
 * commit message 关联 shard-id，便于追溯与单独 revert。
 * 收敛 PR：聚合本 Loop 所有 shard commit，产出 PR 描述（附标注摘要）；`git push` 成功则 PUSHED，否则 DRAFT。
 *
 * 受 `config.git.commit_per_shard` 控制；未启用时所有操作返回 SKIPPED，不破坏 Loop。
 */
@Injectable()
export class CliLoopsGitAdapter implements LoopsGitAdapter {
  constructor(private readonly options: LoopsGitAdapterOptions) {}

  async commitShard(input: {
    issue: { id: string; targetRepo: string };
    shard: { id: string; title: string };
    changedFiles: string[];
  }): Promise<LoopsCommitShardResult> {
    const branch = `loops/${input.issue.id}`;
    if (!this.options.commitPerShard) {
      return {
        shardId: input.shard.id,
        committed: false,
        message: 'commit_per_shard disabled',
        branch,
      };
    }

    const cwd = await resolveAllowedTargetRepo(input.issue.targetRepo);
    const branchOk = await this.git(cwd, ['checkout', '-B', branch]);
    if (!branchOk) {
      return { shardId: input.shard.id, committed: false, message: 'git checkout failed', branch };
    }

    const files = input.changedFiles.length > 0 ? input.changedFiles : ['.'];
    await this.git(cwd, ['add', ...files]);
    const message = `loops(${input.issue.id}): ${input.shard.id} — ${input.shard.title}`;
    const committed = await this.git(cwd, ['commit', '-m', message]);
    return {
      shardId: input.shard.id,
      committed,
      message: committed ? message : 'nothing to commit',
      branch,
    };
  }

  async createConvergencePr(input: LoopsConvergencePrInput): Promise<LoopConvergencePr> {
    const branch = `loops/${input.issue.id}`;
    const baseBranch = this.options.baseBranch;
    const cwd = await resolveAllowedTargetRepo(input.issue.targetRepo);
    const created = new Date().toISOString();
    const annotationsSummary = this.renderAnnotationsSummary(input);
    const prBody = this.renderPrBody(input, annotationsSummary);

    if (!this.options.commitPerShard) {
      return {
        id: `convergence-pr-${input.issue.id}`,
        issueId: input.issue.id,
        branch,
        baseBranch,
        commits: input.commits.map((item) => ({ shardId: item.shardId, message: item.message })),
        annotationsSummary,
        prBody,
        status: 'SKIPPED',
        created,
      };
    }

    const pushed = await this.git(cwd, ['push', '-u', 'origin', branch]);
    return {
      id: `convergence-pr-${input.issue.id}`,
      issueId: input.issue.id,
      branch,
      baseBranch,
      commits: input.commits
        .filter((item) => item.committed)
        .map((item) => ({ shardId: item.shardId, message: item.message })),
      annotationsSummary,
      prBody,
      status: pushed ? 'PUSHED' : 'DRAFT',
      created,
    };
  }

  private async git(cwd: string, args: string[]): Promise<boolean> {
    const result = await runProcess({ command: 'git', args, cwd, timeoutMs: 60_000 });
    return result.exitCode === 0;
  }

  private renderAnnotationsSummary(input: LoopsConvergencePrInput): string {
    return input.annotations
      .map(
        (annotation) =>
          `- ${annotation.target}: impl=${annotation.implStatus} test=${annotation.testStatus} verdict=${annotation.verdict} risk=${annotation.risk}`,
      )
      .join('\n');
  }

  private renderPrBody(input: LoopsConvergencePrInput, annotationsSummary: string): string {
    const commits = input.commits
      .filter((item) => item.committed)
      .map((item) => `- ${item.shardId}: ${item.message}`)
      .join('\n');
    return [
      `# Loops 收敛 PR · ${input.issue.id}`,
      '',
      `## 标题`,
      input.issue.title,
      '',
      `## Shard 提交`,
      commits || '- （无提交，commit_per_shard 未启用或无改动）',
      '',
      `## 标注摘要`,
      annotationsSummary,
      '',
      '> 本 PR 由 Loops 收敛后自动产出，附完整标注摘要，供人最终合并（人在环）。',
    ].join('\n');
  }
}
