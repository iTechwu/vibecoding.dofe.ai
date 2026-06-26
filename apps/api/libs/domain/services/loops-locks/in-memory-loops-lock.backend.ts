import { ConflictException, Injectable } from '@nestjs/common';
import type { LoopsLockBackend } from './loops-lock-backend.interface';

/**
 * Default single-process lock backend. Behaviour is identical to the original
 * in-memory `Set`-based lock: re-entrant acquisition of a held key throws
 * `ConflictException`. Kept as the default so standalone consumers and the
 * existing test suite are unaffected.
 */
@Injectable()
export class InMemoryLoopsLockBackend implements LoopsLockBackend {
  private readonly locks = new Set<string>();

  async acquire(keys: string[]): Promise<void> {
    const held = keys.find((key) => this.locks.has(key));
    if (held) {
      throw new ConflictException(`Loops work lock already held: ${held}`);
    }
    keys.forEach((key) => this.locks.add(key));
  }

  async release(keys: string[]): Promise<void> {
    keys.forEach((key) => this.locks.delete(key));
  }

  /**
   * Synchronous membership query for diagnostics/tests. Only the in-memory
   * backend can answer synchronously; this is intentionally not part of the
   * {@link LoopsLockBackend} interface.
   */
  has(key: string): boolean {
    return this.locks.has(key);
  }
}
