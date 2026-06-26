import { Injectable, Inject, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { LoopLearning } from '@repo/contracts';

// gstack/0, R6 · P1-4
export type LearningLifecycle = 'active' | 'deprecated' | 'superseded' | 'experimental';

export interface CrossWorkspaceLearning {
  learning: LoopLearning;
  sourceWorkspace: string;
  sourceRepo: string;
  confidence: number;
  recallCount: number;
  lastRecalledAt?: string;
}

export interface LearningGovernanceAction {
  action: 'merge' | 'reject' | 'deprecate' | 'supersede';
  sourceId: string;
  targetId?: string;
  actor: string;
  reason?: string;
  timestamp: string;
}

export interface GovernanceSnapshot {
  totalLearnings: number;
  byLifecycle: Record<LearningLifecycle, number>;
  approvalQueue: number;
  deprecated: number;
  crossWorkspaceCount: number;
}

@Injectable()
export class LoopsLearningGovernanceService {
  constructor(@Optional() @Inject(WINSTON_MODULE_PROVIDER) private readonly logger?: Logger) {}

  buildCrossWorkspaceIndex(
    learnings: Array<{ learning: LoopLearning; workspaceId: string; repo: string }>,
  ): CrossWorkspaceLearning[] {
    const byFingerprint = new Map<string, CrossWorkspaceLearning[]>();
    for (const item of learnings) {
      const fp = item.learning.fingerprint ?? item.learning.summary.slice(0, 64);
      const existing = byFingerprint.get(fp) ?? [];
      existing.push({
        learning: item.learning,
        sourceWorkspace: item.workspaceId,
        sourceRepo: item.repo,
        confidence: item.learning.confidence,
        recallCount: item.learning.lastUsedAt ? 1 : 0,
        lastRecalledAt: item.learning.lastUsedAt,
      });
      byFingerprint.set(fp, existing);
    }
    return [...byFingerprint.values()].filter((g) => g.length > 1).flat();
  }

  queryCrossWorkspace(
    workspaceId: string,
    index: CrossWorkspaceLearning[],
    limit = 5,
  ): CrossWorkspaceLearning[] {
    return index
      .filter((item) => item.sourceWorkspace !== workspaceId)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  getApprovalQueue(
    governanceActions: LearningGovernanceAction[],
    learnings: LoopLearning[],
  ): Array<{
    source: LoopLearning;
    target: LoopLearning | undefined;
    action: LearningGovernanceAction;
  }> {
    return governanceActions
      .filter((a) => a.action === 'merge')
      .map((a) => ({
        source: learnings.find((l) => l.id === a.sourceId)!,
        target: learnings.find((l) => l.id === a.targetId),
        action: a,
      }))
      .filter((item) => item.source);
  }

  approveMerge(sourceId: string, targetId: string, actor: string): LearningGovernanceAction {
    return { action: 'merge', sourceId, targetId, actor, timestamp: new Date().toISOString() };
  }

  rejectMerge(sourceId: string, actor: string, reason?: string): LearningGovernanceAction {
    return { action: 'reject', sourceId, actor, reason, timestamp: new Date().toISOString() };
  }

  deprecateLearning(learningId: string, actor: string, reason?: string): LearningGovernanceAction {
    return {
      action: 'deprecate',
      sourceId: learningId,
      actor,
      reason,
      timestamp: new Date().toISOString(),
    };
  }

  applyAgingPolicy(
    learnings: LoopLearning[],
    maxAgeDays = 90,
    minConfidence = 0.3,
  ): { active: LoopLearning[]; deprecated: LoopLearning[] } {
    const now = new Date();
    const cutoff = new Date(now.getTime() - maxAgeDays * 86400000);
    const active: LoopLearning[] = [];
    const deprecated: LoopLearning[] = [];
    for (const learning of learnings) {
      const age = new Date(learning.createdAt);
      if (age < cutoff && learning.confidence < minConfidence) {
        deprecated.push(learning);
      } else {
        active.push(learning);
      }
    }
    return { active, deprecated };
  }

  buildGovernanceSnapshot(
    learnings: LoopLearning[],
    crossWorkspace: CrossWorkspaceLearning[],
    approvalQueue: unknown[],
  ): GovernanceSnapshot {
    const byLifecycle: Record<LearningLifecycle, number> = {
      active: 0,
      deprecated: 0,
      superseded: 0,
      experimental: 0,
    };
    for (const learning of learnings) {
      if (learning.tags?.includes('experimental')) byLifecycle.experimental++;
      else if (learning.tags?.includes('deprecated')) byLifecycle.deprecated++;
      else byLifecycle.active++;
    }
    return {
      totalLearnings: learnings.length,
      byLifecycle,
      approvalQueue: approvalQueue.length,
      deprecated: byLifecycle.deprecated,
      crossWorkspaceCount: crossWorkspace.length,
    };
  }
}
