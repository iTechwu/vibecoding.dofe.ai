import { Injectable } from '@nestjs/common';
import type { LoopConvergencePr } from '@repo/contracts';
import type {
  LoopsCommitShardResult,
  LoopsConvergencePrInput,
  LoopsGitAdapter,
} from './loops-git-adapter.interface';
import { LoopsPrProviderClient } from './loops-pr-provider.client';
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
  constructor(
    private readonly options: LoopsGitAdapterOptions,
    private readonly prProvider = new LoopsPrProviderClient(),
  ) {}

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
    // Idempotency: if nothing is staged after `git add`, skip the commit.
    // This makes the PASS-time commit (reviewShard) and the finalize-time
    // per-shard commit safe no-ops with respect to each other, and avoids
    // creating empty/erroring commits when a shard has already been committed.
    if (!(await this.hasStagedChanges(cwd))) {
      return {
        shardId: input.shard.id,
        committed: false,
        message: 'nothing to commit',
        branch,
      };
    }
    const message = `loops(${input.issue.id}): ${input.shard.id} — ${input.shard.title}`;
    const committed = await this.git(cwd, ['commit', '-m', message]);
    const commitSha = committed ? await this.currentCommitSha(cwd) : undefined;
    return {
      shardId: input.shard.id,
      committed,
      message: committed ? message : 'nothing to commit',
      branch,
      commitSha,
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
        commits: input.commits.map((item) => ({
          shardId: item.shardId,
          message: item.message,
          commitSha: item.commitSha,
          branch: item.branch,
        })),
        annotationsSummary,
        prBody,
        status: 'SKIPPED',
        created,
      };
    }

    const pushed = await this.git(cwd, ['push', '-u', 'origin', branch]);
    const opened = pushed
      ? await this.prProvider.openPullRequest({
          branch,
          baseBranch,
          title: `Loops ${input.issue.id}: ${input.issue.title}`,
          body: prBody,
        })
      : { opened: false as const, reason: 'git push failed' };
    return {
      id: opened.opened ? opened.id : `convergence-pr-${input.issue.id}`,
      issueId: input.issue.id,
      branch,
      baseBranch,
      provider: opened.opened ? opened.provider : undefined,
      url: opened.opened ? opened.url : undefined,
      commits: input.commits
        .filter((item) => item.committed)
        .map((item) => ({
          shardId: item.shardId,
          message: item.message,
          commitSha: item.commitSha,
          branch: item.branch,
        })),
      annotationsSummary,
      prBody: opened.opened ? prBody : `${prBody}\n\n## Provider 状态\n${opened.reason}`,
      status: opened.opened ? 'OPENED' : pushed ? 'PUSHED' : 'DRAFT',
      created,
    };
  }

  private async git(cwd: string, args: string[]): Promise<boolean> {
    const result = await runProcess({ command: 'git', args, cwd, timeoutMs: 60_000 });
    return result.exitCode === 0;
  }

  private async currentCommitSha(cwd: string): Promise<string | undefined> {
    const result = await runProcess({
      command: 'git',
      args: ['rev-parse', 'HEAD'],
      cwd,
      timeoutMs: 30_000,
    });
    const sha = result.stdout.trim();
    return result.exitCode === 0 && sha.length >= 7 ? sha : undefined;
  }

  /**
   * `git diff --cached --quiet` exits 0 when there are no staged changes and
   * 1 when staged changes exist (and non-zero on error). We treat anything
   * non-zero as "has staged changes" so an unexpected git error does not
   * silently suppress a commit.
   */
  private async hasStagedChanges(cwd: string): Promise<boolean> {
    const result = await runProcess({
      command: 'git',
      args: ['diff', '--cached', '--quiet'],
      cwd,
      timeoutMs: 30_000,
    });
    return result.exitCode !== 0;
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
      .map((item) => {
        const sha = item.commitSha ? ` (${item.commitSha.slice(0, 12)})` : '';
        return `- ${item.shardId}: ${item.message}${sha}`;
      })
      .join('\n');
    const evidenceSummary = this.renderEvidenceSummary(input);
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
      `## Evidence 摘要`,
      evidenceSummary,
      '',
      '> 本 PR 由 Loops 收敛后自动产出，附完整标注摘要，供人最终合并（人在环）。',
    ].join('\n');
  }

  private renderEvidenceSummary(input: LoopsConvergencePrInput): string {
    const artifacts = (input.evidenceArtifacts ?? []).filter(
      (artifact) => artifact.status === 'present',
    );
    if (artifacts.length === 0) {
      return '- （无已记录 evidence artifacts）';
    }
    return artifacts
      .slice(0, 12)
      .map((artifact) => {
        const count = artifact.count === undefined ? '' : ` · count=${artifact.count}`;
        const round = artifact.round === undefined ? '' : ` · round=${artifact.round}`;
        return `- ${artifact.label} [${artifact.kind}]${round}${count}: ${artifact.summary} (${artifact.path})`;
      })
      .join('\n');
  }
}
