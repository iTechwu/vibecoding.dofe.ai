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
});
