import { Inject, Injectable, Optional } from '@nestjs/common';
import { InMemoryLoopsLockBackend } from './in-memory-loops-lock.backend';
import { LOOPS_LOCK_BACKEND, type LoopsLockBackend } from './loops-lock-backend.interface';

@Injectable()
export class LoopsWorkLockService {
  private readonly backend: LoopsLockBackend;

  constructor(
    @Optional()
    @Inject(LOOPS_LOCK_BACKEND)
    backend?: LoopsLockBackend,
  ) {
    // Default to the in-memory backend so standalone consumers (and the
    // existing test suite) behave exactly as before. The Nest module binds
    // `LOOPS_LOCK_BACKEND` to a concrete backend (in-memory now; Redis when
    // multi-instance locking is enabled).
    this.backend = backend ?? new InMemoryLoopsLockBackend();
  }

  async withIssueAndRepoLock<T>(
    input: { issueId: string; targetRepo: string },
    work: () => Promise<T>,
  ) {
    const keys = [`issue:${input.issueId}`, `repo:${input.targetRepo}`].sort();
    await this.backend.acquire(keys);
    try {
      return await work();
    } finally {
      await this.backend.release(keys);
    }
  }

  /**
   * Synchronous lock query for diagnostics/tests. Only meaningful for the
   * in-memory backend (the default); a Redis backend cannot answer
   * synchronously and reports `false`.
   */
  isLocked(key: string): boolean {
    return this.backend instanceof InMemoryLoopsLockBackend && this.backend.has(key);
  }
}
