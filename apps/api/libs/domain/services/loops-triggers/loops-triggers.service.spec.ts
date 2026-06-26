import { NotFoundException } from '@nestjs/common';
import type { LoopScheduleTrigger } from '@repo/contracts';
import { LoopsTriggersService } from './loops-triggers.service';

describe('LoopsTriggersService', () => {
  function buildTrigger(overrides: Partial<LoopScheduleTrigger> = {}): LoopScheduleTrigger {
    return {
      id: 'sched-1',
      workspaceId: 'default',
      name: 'nightly-bugfix',
      cronExpression: '0 2 * * *',
      templateTitle: 'Nightly bugfix loop',
      targetRepo: '.',
      templateBody: 'Run the nightly bugfix sweep across the repo.',
      templatePriority: 'P2',
      templateAcceptanceCriteria: ['sweep completed'],
      status: 'active',
      failureCount: 0,
      maxFailures: 3,
      lastRunAt: undefined,
      nextRunAt: '2026-06-26T02:00:00.000Z',
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
      owner: undefined,
      ...overrides,
    };
  }

  function buildService(trigger?: LoopScheduleTrigger | null) {
    const store = {
      readScheduleTrigger: jest.fn().mockReturnValue(trigger ?? null),
      writeScheduleTrigger: jest.fn(),
      nextTriggerExecutionSeq: jest.fn().mockReturnValue(7),
      writeTriggerExecution: jest.fn(),
    };
    const issueCreationPort = { createIssue: jest.fn() };
    const logSink = { log: jest.fn() };
    const service = new LoopsTriggersService(store as never);
    return { service, store, issueCreationPort, logSink };
  }

  describe('CRUD delegation', () => {
    it('reads a schedule trigger via the store and throws when missing', () => {
      const { service, store } = buildService(buildTrigger());
      expect(service.getScheduleTrigger('sched-1')).toEqual(buildTrigger());
      expect(store.readScheduleTrigger).toHaveBeenCalledWith('sched-1');

      const missing = buildService(null);
      expect(() => missing.service.getScheduleTrigger('nope')).toThrow(NotFoundException);
    });
  });

  describe('fireScheduleTrigger', () => {
    it('returns a paused response without creating an issue when the trigger is paused', async () => {
      const { service, store, issueCreationPort, logSink } = buildService(
        buildTrigger({ status: 'paused' }),
      );

      const result = await service.fireScheduleTrigger(
        'sched-1',
        { reason: 'manual' },
        issueCreationPort,
        logSink,
      );

      expect(result).toEqual({
        loopId: '',
        issueId: '',
        source: 'schedule',
        event: 'nightly-bugfix',
        created: false,
        message: 'Schedule trigger sched-1 is paused — resume it first',
      });
      expect(issueCreationPort.createIssue).not.toHaveBeenCalled();
      expect(store.writeScheduleTrigger).not.toHaveBeenCalled();
      expect(store.writeTriggerExecution).not.toHaveBeenCalled();
    });

    it('creates an issue, records the execution, and resets failure stats on success', async () => {
      const { service, store, issueCreationPort, logSink } = buildService(
        buildTrigger({ failureCount: 2 }),
      );
      issueCreationPort.createIssue.mockResolvedValue({ issue: { id: 'issue-42' } });

      const result = await service.fireScheduleTrigger(
        'sched-1',
        { reason: 'manual' },
        issueCreationPort,
        logSink,
      );

      expect(issueCreationPort.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nightly bugfix loop',
          targetRepo: '.',
          sourceChannel: 'schedule',
          sourceKind: 'schedule',
        }),
      );

      const [updatedTrigger] = store.writeScheduleTrigger.mock.calls[0];
      expect(updatedTrigger).toEqual(
        expect.objectContaining({
          id: 'sched-1',
          failureCount: 0,
          lastRunAt: expect.any(String),
          nextRunAt: expect.any(String),
        }),
      );

      const [execution] = store.writeTriggerExecution.mock.calls[0];
      expect(execution).toEqual(
        expect.objectContaining({
          id: 'exec-7',
          triggerId: 'sched-1',
          triggerType: 'schedule',
          status: 'completed',
          outputLoopId: 'issue-42',
          outputIssueId: 'issue-42',
          attempt: 1,
          maxRetries: 3,
        }),
      );

      expect(logSink.log).toHaveBeenCalledWith(
        'info',
        '[Loops] Schedule trigger fired manually',
        expect.objectContaining({ triggerId: 'sched-1', issueId: 'issue-42' }),
      );

      expect(result).toEqual({
        loopId: 'issue-42',
        issueId: 'issue-42',
        source: 'schedule',
        event: 'nightly-bugfix',
        created: true,
        message: expect.stringContaining('issue-42'),
      });
    });

    it('increments failureCount, keeps status active below the threshold, and returns a failed response', async () => {
      const { service, store, issueCreationPort, logSink } = buildService(
        buildTrigger({ failureCount: 1 }),
      );
      issueCreationPort.createIssue.mockRejectedValue(new Error('intake blew up'));

      const result = await service.fireScheduleTrigger(
        'sched-1',
        undefined,
        issueCreationPort,
        logSink,
      );

      const [updatedTrigger] = store.writeScheduleTrigger.mock.calls[0];
      expect(updatedTrigger).toEqual(
        expect.objectContaining({ failureCount: 2, status: 'active' }),
      );
      expect(store.writeTriggerExecution).not.toHaveBeenCalled();
      expect(logSink.log).toHaveBeenCalledWith(
        'error',
        '[Loops] Schedule trigger fire failed',
        expect.objectContaining({ triggerId: 'sched-1', failureCount: 2 }),
      );
      expect(result).toEqual(
        expect.objectContaining({ created: false, message: 'Failed: intake blew up' }),
      );
    });

    it('flips the trigger status to error once failureCount reaches maxFailures', async () => {
      const { service, store, issueCreationPort, logSink } = buildService(
        buildTrigger({ failureCount: 2 }),
      );
      issueCreationPort.createIssue.mockRejectedValue(new Error('still failing'));

      await service.fireScheduleTrigger('sched-1', undefined, issueCreationPort, logSink);

      const [updatedTrigger] = store.writeScheduleTrigger.mock.calls[0];
      expect(updatedTrigger).toEqual(expect.objectContaining({ failureCount: 3, status: 'error' }));
    });

    it('throws NotFoundException when the trigger does not exist', async () => {
      const { service, issueCreationPort, logSink } = buildService(null);
      await expect(
        service.fireScheduleTrigger('missing', undefined, issueCreationPort, logSink),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not require a log sink (orchestration stays observable via return value)', async () => {
      const { service, store, issueCreationPort } = buildService(buildTrigger());
      issueCreationPort.createIssue.mockResolvedValue({ issue: { id: 'issue-9' } });

      const result = await service.fireScheduleTrigger('sched-1', undefined, issueCreationPort);

      expect(result.created).toBe(true);
      expect(store.writeTriggerExecution).toHaveBeenCalled();
    });
  });
});
