/**
 * Concurrency backend for Loops work locks.
 *
 * The default {@link InMemoryLoopsLockBackend} preserves the original
 * single-process behaviour. A Redis-backed implementation makes
 * `withIssueAndRepoLock` safe across multiple API instances — the biggest
 * production-readiness gap called out in the crewAI gap analysis
 * (`docs/0621/crewAI/02-loops-current-state-analysis.md` §2.3).
 *
 * `acquire` MUST be atomic with respect to the keys it is given and MUST throw
 * `ConflictException` when any key is already held. Backends that cannot
 * guarantee atomicity across multiple keys MUST roll back any keys they
 * partially acquired before throwing.
 */
export interface LoopsLockBackend {
  acquire(keys: string[]): Promise<void>;
  release(keys: string[]): Promise<void>;
}

export const LOOPS_LOCK_BACKEND = Symbol('LOOPS_LOCK_BACKEND');
