import { LoopsAdvanceProcessor } from './loops-advance.processor';

describe('LoopsAdvanceProcessor', () => {
  it('executes the existing advance state machine for the queued issue', async () => {
    const advance = jest.fn().mockResolvedValue({
      state: { phase: 'PHASE_2_REVIEW' },
      issue: { status: 'IN_LOOP' },
    });
    const record = jest.fn();
    const processor = new LoopsAdvanceProcessor(
      { info: jest.fn(), error: jest.fn() } as never,
      { advance } as never,
      { record } as never,
    );

    await expect(
      processor.process({ id: 'job-1', attemptsMade: 0, data: { issueId: 'issue-1' } } as never),
    ).resolves.toEqual({ issueId: 'issue-1', phase: 'PHASE_2_REVIEW', status: 'IN_LOOP' });
    expect(advance).toHaveBeenCalledWith('issue-1');
    expect(record).toHaveBeenNthCalledWith(1, {
      jobId: 'job-1',
      issueId: 'issue-1',
      status: 'active',
      attempt: 1,
    });
    expect(record).toHaveBeenNthCalledWith(2, {
      jobId: 'job-1',
      issueId: 'issue-1',
      status: 'completed',
      attempt: 1,
      phase: 'PHASE_2_REVIEW',
      issueStatus: 'IN_LOOP',
    });
  });

  it('marks a stalled job as retrying so a recovered worker can resume it', async () => {
    const markStalled = jest.fn();
    const processor = new LoopsAdvanceProcessor(
      { info: jest.fn(), error: jest.fn() } as never,
      { advance: jest.fn() } as never,
      { markStalled } as never,
    );

    await processor.onStalled('advance:issue-1');

    expect(markStalled).toHaveBeenCalledWith('advance:issue-1');
  });

  it('persists a terminal failed state after the final BullMQ attempt', async () => {
    const record = jest.fn();
    const processor = new LoopsAdvanceProcessor(
      { info: jest.fn(), error: jest.fn() } as never,
      { advance: jest.fn() } as never,
      { record } as never,
    );

    await processor.onFailed(
      {
        id: 'advance:issue-1',
        attemptsMade: 3,
        opts: { attempts: 3 },
        data: { issueId: 'issue-1' },
      } as never,
      new Error('worker crashed'),
    );

    expect(record).toHaveBeenCalledWith({
      jobId: 'advance:issue-1',
      issueId: 'issue-1',
      status: 'failed',
      attempt: 3,
    });
  });

  it('persists retrying while BullMQ still has attempts remaining', async () => {
    const record = jest.fn();
    const processor = new LoopsAdvanceProcessor(
      { info: jest.fn(), error: jest.fn() } as never,
      { advance: jest.fn() } as never,
      { record } as never,
    );

    await processor.onFailed(
      {
        id: 'advance:issue-1',
        attemptsMade: 1,
        opts: { attempts: 3 },
        data: { issueId: 'issue-1' },
      } as never,
      new Error('temporary worker failure'),
    );

    expect(record).toHaveBeenCalledWith({
      jobId: 'advance:issue-1',
      issueId: 'issue-1',
      status: 'retrying',
      attempt: 1,
    });
  });
});
