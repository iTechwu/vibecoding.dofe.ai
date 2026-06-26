import { Injectable } from '@nestjs/common';
import type { LoopShard, LoopStateItem } from '@repo/contracts';

/** Human-readable labels for loop phases (used by `formatPhase`). */
const PHASE_LABELS: Record<string, string> = {
  PHASE_0_INTAKE: 'Intake',
  PHASE_1_SPEC: 'Spec',
  PHASE_2_REVIEW: 'Review',
  PHASE_3_DECOMPOSE: 'Decompose',
  PHASE_4_IMPLEMENT: 'Implement',
  PHASE_5_REVIEW: 'Shard Review',
  PHASE_6_CONVERGE: 'Converge',
  PHASE_7_GLOBAL_REVIEW: 'Global Review',
  PHASE_8_ANNOTATE: 'Annotate',
  CLOSED: 'Closed',
  PAUSED: 'Paused',
};

/**
 * Loops Engine domain service — `@app/services/loops-engine`.
 *
 * 结构优化 Step 3：把 loop 状态机的「纯状态推导原语」从 8000 行 `LoopsService` 下沉。
 *
 * 当前承接（本批，均为纯函数，无 DI 依赖）：
 * - `nextResumePhase`：恢复时下一个 phase（依赖 shard/spec 状态）。
 * - `nextSpecVersion`：spec 版本号自增（`v0`→`v1`→…）。
 * - `findRunnableShard`：挑选下一个可执行 shard（依赖解除 + TODO/NEEDS-WORK）。
 * - `formatPhase`：phase → 人类可读 label。
 *
 * `LoopsService` 委托 `this.engine.*`。后续 Step 补齐：
 * - `generateSpec`/`reviewSpec`/`decompose`/`runLoop`/`advance`/`reviewGlobal`/`reloop`/
 *   `finalize` 等状态机推进方法：依赖 `syncAndRead`（persistence/store + coverage enrich）
 *   与 runner/evidence/quality，需先沉淀 detail-read/write 到 store、enricher 到 evidence
 *   （Step 5）后再做完整抽取（最高风险节点，单独循环）。
 * - `costGuardedState`：依赖 `store.enforceCostGuard`，随 store 编排一起迁。
 *
 * 依赖方向：仅 `@repo/contracts`，无 `src/modules/**`、无 `@app/db`。
 */
@Injectable()
export class LoopsEngineService {
  /** Pick the phase to resume into after an interruption. */
  nextResumePhase(state: LoopStateItem): LoopStateItem['phase'] {
    if (state.shardsTotal > 0) return 'PHASE_4_IMPLEMENT';
    if (state.specVersion === 'v0') return 'PHASE_1_SPEC';
    return 'PHASE_2_REVIEW';
  }

  /** Bump the spec version: `v0` → `v1` → `v2` … */
  nextSpecVersion(current: string): string {
    if (current === 'v0') return 'v1';
    const currentNumber = Number(current.replace('v', ''));
    return `v${Number.isFinite(currentNumber) ? currentNumber + 1 : 1}`;
  }

  /** Find the next shard that is ready to run (deps DONE, status TODO/NEEDS-WORK). */
  findRunnableShard(shards: LoopShard[]): LoopShard | undefined {
    return shards.find(
      (shard) =>
        (shard.status === 'TODO' || shard.status === 'NEEDS-WORK') &&
        shard.dependsOn.every((dependency) =>
          shards.some((candidate) => candidate.id === dependency && candidate.status === 'DONE'),
        ),
    );
  }

  /** Map a phase id to a human-readable label. */
  formatPhase(phase: string): string {
    return PHASE_LABELS[phase] ?? phase.replace('PHASE_', 'P').replaceAll('_', ' ');
  }
}
