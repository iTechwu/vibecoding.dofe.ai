import type { LoopImplementationRecord, LoopIssue, LoopShard } from '@repo/contracts';

/**
 * Claude Code 双手 Adapter（07 §3）。
 *
 * 以非交互模式启动一个独立、短命的 Claude Code 进程实施单个 Shard，
 * 进程结束后回收 Implementation Record（改动文件、关键决策、自测、token）。
 * 默认实现为确定性 MVP；真实 CLI 实现见 `cli-loops-claude.adapter.ts`。
 */
export type LoopsClaudeRunInput = {
  issue: LoopIssue;
  shard: LoopShard;
  round: number;
  cwd: string;
};

export type LoopsClaudeRunResult = {
  record: LoopImplementationRecord;
};

export interface LoopsClaudeAdapter {
  run(input: LoopsClaudeRunInput): Promise<LoopsClaudeRunResult>;
}

export const LOOPS_CLAUDE_ADAPTER = Symbol('LOOPS_CLAUDE_ADAPTER');
