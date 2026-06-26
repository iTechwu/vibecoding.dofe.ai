import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateLoopIssueRequest,
  CreateScheduleTriggerRequest,
  LoopIssuesQuery,
  LoopScheduleTrigger,
  LoopScheduleTriggerListResponse,
  LoopTriggerExecution,
  LoopWebhookTriggerResponse,
  UpdateScheduleTriggerRequest,
} from '@repo/contracts';
import { LoopsFileStoreService } from '@app/services/loops-store';

/**
 * Issue creation port for trigger fire. The full intake pipeline (id minting,
 * submitter derivation, workflow recipe, persistence) stays in the API facade;
 * the triggers domain only needs the resulting issue id. Bound in the API
 * module via `useExisting: LoopsService` until the intake orchestration itself
 * moves to `loops-issues`.
 */
export const LOOPS_ISSUE_CREATION_PORT = 'LOOPS_ISSUE_CREATION_PORT';

export interface LoopsIssueCreationPort {
  createIssue(input: CreateLoopIssueRequest): Promise<{ issue: { id: string } }>;
}

/**
 * Optional log sink so the domain orchestration can emit the same `[Loops]`
 * lifecycle logs the facade used to own, without depending on Winston directly.
 */
export interface LoopsTriggersLogSink {
  log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void;
}

@Injectable()
export class LoopsTriggersService {
  constructor(private readonly store: LoopsFileStoreService) {}

  listScheduleTriggers(query: LoopIssuesQuery): LoopScheduleTriggerListResponse {
    const { limit = 20, page = 1 } = query;
    const offset = (page - 1) * limit;
    const triggers = this.store.listScheduleTriggers();
    const paged = triggers.slice(offset, offset + limit);
    return {
      list: paged,
      total: triggers.length,
      page,
      limit,
    };
  }

  getScheduleTrigger(triggerId: string): LoopScheduleTrigger {
    const trigger = this.store.readScheduleTrigger(triggerId);
    if (!trigger) throw new NotFoundException(`Schedule trigger ${triggerId} not found`);
    return trigger;
  }

  createScheduleTrigger(input: CreateScheduleTriggerRequest): LoopScheduleTrigger {
    const now = new Date().toISOString();
    const trigger: LoopScheduleTrigger = {
      id: `sched-${this.store.nextScheduleTriggerSeq()}`,
      workspaceId: 'default',
      ...input,
      templatePriority: input.templatePriority ?? 'P2',
      status: 'active',
      failureCount: 0,
      maxFailures: 3,
      lastRunAt: undefined,
      nextRunAt: this.computeNextCronTime(input.cronExpression),
      createdAt: now,
      updatedAt: now,
      owner: input.owner,
    };
    this.store.writeScheduleTrigger(trigger);
    return trigger;
  }

  updateScheduleTrigger(
    triggerId: string,
    input: UpdateScheduleTriggerRequest,
  ): LoopScheduleTrigger {
    const existing = this.getScheduleTrigger(triggerId);
    const now = new Date().toISOString();
    const updated: LoopScheduleTrigger = {
      ...existing,
      ...input,
      templatePriority: input.templatePriority ?? existing.templatePriority,
      failureCount: existing.failureCount,
      maxFailures: existing.maxFailures,
      lastRunAt: existing.lastRunAt,
      nextRunAt: input.cronExpression
        ? this.computeNextCronTime(input.cronExpression)
        : existing.nextRunAt,
      updatedAt: now,
    };
    this.store.writeScheduleTrigger(updated);
    return updated;
  }

  deleteScheduleTrigger(triggerId: string): { deleted: boolean; triggerId: string } {
    this.getScheduleTrigger(triggerId);
    this.store.deleteScheduleTrigger(triggerId);
    return { deleted: true, triggerId };
  }

  /**
   * Fire a schedule trigger: read the trigger, create a Loop issue via the
   * issue-creation port, then record the execution and update trigger stats
   * (lastRunAt / nextRunAt / failureCount). Issue intake itself is delegated
   * to the port; this method only owns the trigger-lifecycle orchestration.
   *
   * 行为与 legacy `LoopsService.fireScheduleTrigger` 一致，便于后续删除 facade wrapper。
   */
  async fireScheduleTrigger(
    triggerId: string,
    input: { reason?: string } | undefined,
    issueCreationPort: LoopsIssueCreationPort,
    logSink?: LoopsTriggersLogSink,
  ): Promise<LoopWebhookTriggerResponse> {
    const trigger = this.getScheduleTrigger(triggerId);
    const now = new Date().toISOString();

    if (trigger.status === 'paused') {
      return {
        loopId: '',
        issueId: '',
        source: 'schedule',
        event: trigger.name,
        created: false,
        message: `Schedule trigger ${triggerId} is paused — resume it first`,
      };
    }

    try {
      const result = await issueCreationPort.createIssue({
        title: trigger.templateTitle,
        targetRepo: trigger.targetRepo,
        body: trigger.templateBody,
        priority: trigger.templatePriority,
        acceptanceCriteria: trigger.templateAcceptanceCriteria,
        sourceChannel: 'schedule',
        sourceKind: 'schedule',
      });

      const updated: LoopScheduleTrigger = {
        ...trigger,
        lastRunAt: now,
        nextRunAt: this.computeNextCronTime(trigger.cronExpression),
        failureCount: 0,
        updatedAt: now,
      };
      this.store.writeScheduleTrigger(updated);

      const execution: LoopTriggerExecution = {
        id: `exec-${this.store.nextTriggerExecutionSeq()}`,
        triggerId: trigger.id,
        triggerType: 'schedule',
        status: 'completed',
        inputPayload: { reason: input?.reason, templateTitle: trigger.templateTitle },
        outputLoopId: result.issue.id,
        outputIssueId: result.issue.id,
        attempt: 1,
        maxRetries: 3,
        createdAt: now,
        completedAt: now,
      };
      this.store.writeTriggerExecution(execution);

      logSink?.log('info', `[Loops] Schedule trigger fired manually`, {
        triggerId,
        issueId: result.issue.id,
        reason: input?.reason,
      });

      return {
        loopId: result.issue.id,
        issueId: result.issue.id,
        source: 'schedule',
        event: trigger.name,
        created: true,
        message: `Loop issue ${result.issue.id} created from schedule trigger "${trigger.name}"`,
      };
    } catch (error) {
      const failureCount = trigger.failureCount + 1;
      const updated: LoopScheduleTrigger = {
        ...trigger,
        failureCount,
        status: failureCount >= trigger.maxFailures ? 'error' : trigger.status,
        lastRunAt: now,
        updatedAt: now,
      };
      this.store.writeScheduleTrigger(updated);

      logSink?.log('error', `[Loops] Schedule trigger fire failed`, {
        triggerId,
        error: error instanceof Error ? error.message : String(error),
        failureCount,
      });

      return {
        loopId: '',
        issueId: '',
        source: 'schedule',
        event: trigger.name,
        created: false,
        message: `Failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  computeNextCronTime(cronExpression: string): string | undefined {
    try {
      const now = new Date();
      const parts = cronExpression.trim().split(/\s+/);
      if (parts.length < 5) return undefined;
      const next = new Date(now);
      if (parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
        const hour = parseInt(parts[1], 10);
        const minute = parseInt(parts[0], 10);
        next.setHours(hour, minute, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
      } else if (parts[4] !== '*') {
        const targetDay = parseInt(parts[4], 10);
        const hour = parseInt(parts[1], 10);
        const minute = parseInt(parts[0], 10);
        next.setHours(hour, minute, 0, 0);
        const currentDay = next.getDay() || 7;
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0 && next <= now) daysUntil += 7;
        next.setDate(next.getDate() + daysUntil);
      } else {
        next.setHours(next.getHours() + 1, 0, 0, 0);
      }
      return next.toISOString();
    } catch {
      return undefined;
    }
  }
}
