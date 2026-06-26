import { ConflictException } from '@nestjs/common';
import { LoopsWorkLockService } from './loops-work-lock.service';

describe('LoopsWorkLockService', () => {
  it('blocks concurrent work for the same issue', async () => {
    const service = new LoopsWorkLockService();

    await expect(
      service.withIssueAndRepoLock({ issueId: 'issue-1', targetRepo: '/repo/a' }, async () => {
        expect(service.isLocked('issue:issue-1')).toBe(true);
        return service.withIssueAndRepoLock(
          { issueId: 'issue-1', targetRepo: '/repo/b' },
          async () => 'nested',
        );
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(service.isLocked('issue:issue-1')).toBe(false);
  });

  it('blocks concurrent work for the same repo and releases locks after success', async () => {
    const service = new LoopsWorkLockService();

    await expect(
      service.withIssueAndRepoLock({ issueId: 'issue-1', targetRepo: '/repo/a' }, async () => {
        expect(service.isLocked('repo:/repo/a')).toBe(true);
        await expect(
          service.withIssueAndRepoLock({ issueId: 'issue-2', targetRepo: '/repo/a' }, async () => {
            return 'nested';
          }),
        ).rejects.toBeInstanceOf(ConflictException);
        return 'done';
      }),
    ).resolves.toBe('done');
    expect(service.isLocked('repo:/repo/a')).toBe(false);
  });

  it('serialises truly concurrent Promise.all attempts for the same issue (R13)', async () => {
    const service = new LoopsWorkLockService();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        service.withIssueAndRepoLock(
          { issueId: 'issue-race', targetRepo: '/repo/race' },
          async () => 'won',
        ),
      ),
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    // Exactly one concurrent attempt acquires; the rest are rejected.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    expect(service.isLocked('issue:issue-race')).toBe(false);
  });
});
