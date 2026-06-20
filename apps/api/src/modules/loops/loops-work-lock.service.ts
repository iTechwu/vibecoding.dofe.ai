import { ConflictException, Injectable } from '@nestjs/common';

@Injectable()
export class LoopsWorkLockService {
  private readonly locks = new Set<string>();

  async withIssueAndRepoLock<T>(
    input: { issueId: string; targetRepo: string },
    work: () => Promise<T>,
  ) {
    const keys = [`issue:${input.issueId}`, `repo:${input.targetRepo}`].sort();
    this.acquire(keys);
    try {
      return await work();
    } finally {
      this.release(keys);
    }
  }

  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  private acquire(keys: string[]): void {
    const locked = keys.find((key) => this.locks.has(key));
    if (locked) {
      throw new ConflictException(`Loops work lock already held: ${locked}`);
    }
    keys.forEach((key) => this.locks.add(key));
  }

  private release(keys: string[]): void {
    keys.forEach((key) => this.locks.delete(key));
  }
}
