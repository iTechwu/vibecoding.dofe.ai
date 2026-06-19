import type { LoopAnnotation, LoopIssue, LoopShard, LoopSpec } from '@repo/contracts';

export type LoopsDecomposition = {
  shards: LoopShard[];
  annotations: LoopAnnotation[];
};

export interface LoopsAgentAdapter {
  plan(issue: LoopIssue, createdAt: string): Promise<LoopSpec>;
  decompose(issue: LoopIssue, spec: LoopSpec): Promise<LoopsDecomposition>;
}

export const LOOPS_AGENT_ADAPTER = Symbol('LOOPS_AGENT_ADAPTER');
