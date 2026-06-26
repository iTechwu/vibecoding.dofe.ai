import { Injectable } from '@nestjs/common';
import type { LoopImplementationRecord } from '@repo/contracts';
import type { LoopsClaudeAdapter, LoopsClaudeRunInput } from './loops-claude-adapter.interface';

/**
 * 确定性 Claude Code 双手实现（默认）。
 *
 * 不启动真实 `claude` 进程，而是基于 Shard 自身信息产出一份可复现的 Implementation Record，
 * 使 Loop 在无 agent CLI 时也能端到端跑通（拆解 → 实施 → 测试 → 审查 → 收敛）。
 * 真实 CLI 实现见 `CliLoopsClaudeAdapter`。
 */
@Injectable()
export class DeterministicLoopsClaudeAdapter implements LoopsClaudeAdapter {
  async run(input: LoopsClaudeRunInput) {
    const { issue, shard, round } = input;
    const created = new Date().toISOString();
    const changedFiles = shard.filesHint.slice(0, 2);
    const record: LoopImplementationRecord = {
      id: `impl-record-${shard.id}-r${round}-${Date.now()}`,
      issueId: issue.id,
      shardId: shard.id,
      round,
      implementer: 'claude-code',
      status: 'IMPLEMENTED',
      summary: `已按 Shard 验收要求实现：${shard.acceptance.join('；')}`,
      changedFiles,
      notes: '确定性实施：实际 Claude Code CLI 未启用，使用模板产出实现证据。',
      created,
      tokens: Math.min(shard.estContext, 8000),
      durationSec: 1,
      testsChanged: [],
    };
    return { record };
  }
}
