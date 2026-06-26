import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateScheduleTriggerRequest,
  LoopIssuesQuery,
  LoopScheduleTrigger,
  LoopScheduleTriggerListResponse,
  UpdateScheduleTriggerRequest,
} from '@repo/contracts';
import { LoopsFileStoreService } from '@app/services/loops-store';

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
