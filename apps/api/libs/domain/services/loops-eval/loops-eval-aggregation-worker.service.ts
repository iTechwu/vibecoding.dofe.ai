import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { createHash } from 'crypto';
import { RedisService } from '@dofe/infra-redis';

/**
 * R33+: Cross-tenant Eval real-time aggregation via DB + Redis + BullMQ.
 *
 * Three-tier architecture:
 * ┌─────────────────────────────────────────────┐
 * │ Tier 1: Redis Cache (RedisService, TTL 300s)│
 * │ Tier 2: DB Query (LoopEvalAggregationService)│
 * │ Tier 3: BullMQ background worker (periodic) │
 * └─────────────────────────────────────────────┘
 *
 * Redis key schema:
 *   loops:eval:agg:{tenantId}:{suiteId}:{period} → JSON aggregation
 *   loops:eval:agg:ts:{tenantId}:{suiteId}:{period} → last computed timestamp
 *   loops:eval:agg:fingerprint:{tenantId}:{suiteId}:{period} → content hash
 */
@Injectable()
export class LoopsEvalAggregationWorkerService {
  private readonly REDIS_PREFIX = 'loops:eval:agg';
  private readonly DEFAULT_TTL_SEC = 300; // 5 minutes cache

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Optional() private readonly redis?: RedisService,
  ) {}

  // =========================================================================
  // Redis Cache Layer — using @dofe/infra-redis RedisService
  // =========================================================================

  private cacheKey(tenantId: string, suiteId: string, period: string): string {
    return `${this.REDIS_PREFIX}:${tenantId}:${suiteId}:${period}`;
  }

  private cacheTsKey(tenantId: string, suiteId: string, period: string): string {
    return `${this.REDIS_PREFIX}:ts:${tenantId}:${suiteId}:${period}`;
  }

  private cacheFingerprintKey(tenantId: string, suiteId: string, period: string): string {
    return `${this.REDIS_PREFIX}:fingerprint:${tenantId}:${suiteId}:${period}`;
  }

  /** Check if Redis is available and connected. */
  private get redisAvailable(): boolean {
    return Boolean(this.redis);
  }

  async getCachedAggregation(
    tenantId: string,
    suiteId: string,
    period: string,
  ): Promise<Record<string, unknown> | null> {
    if (!this.redisAvailable) return null;
    try {
      const raw = await this.redis!.get(this.cacheKey(tenantId, suiteId, period));
      if (!raw) return null;

      const data = JSON.parse(raw);
      // Check if cache is stale by comparing fingerprints
      const cachedFingerprint = await this.redis!.get(
        this.cacheFingerprintKey(tenantId, suiteId, period),
      );
      if (cachedFingerprint && data._fingerprint !== cachedFingerprint) {
        // Stale cache — fingerprint mismatch means underlying data changed
        await this.invalidateCache(tenantId, suiteId);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  async setCachedAggregation(
    tenantId: string,
    suiteId: string,
    period: string,
    data: Record<string, unknown>,
    fingerprint?: string,
  ): Promise<void> {
    if (!this.redisAvailable) return;
    try {
      const fp = fingerprint ?? this.computeFingerprint(data);
      const payload = { ...data, _fingerprint: fp, _cachedAt: new Date().toISOString() };

      const key = this.cacheKey(tenantId, suiteId, period);
      await this.redis!.set(key, JSON.stringify(payload), { EX: this.DEFAULT_TTL_SEC });
      await this.redis!.set(this.cacheFingerprintKey(tenantId, suiteId, period), fp, {
        EX: this.DEFAULT_TTL_SEC,
      });
      await this.redis!.set(this.cacheTsKey(tenantId, suiteId, period), new Date().toISOString(), {
        EX: this.DEFAULT_TTL_SEC,
      });
    } catch (error) {
      this.log('warn', 'Failed to cache aggregation in Redis', { error });
    }
  }

  async getCacheTimestamp(
    tenantId: string,
    suiteId: string,
    period: string,
  ): Promise<string | null> {
    if (!this.redisAvailable) return null;
    try {
      return await this.redis!.get(this.cacheTsKey(tenantId, suiteId, period));
    } catch {
      return null;
    }
  }

  async invalidateCache(tenantId: string, suiteId?: string): Promise<void> {
    if (!this.redisAvailable) return;
    const periods = ['7d', '30d', '90d', 'all'];
    try {
      for (const period of periods) {
        const targets = suiteId
          ? [suiteId]
          : [
              'architecture-compliance',
              'delivery-readiness',
              'runtime-safety',
              'test-evidence',
              'cost-policy',
            ];
        for (const sid of targets) {
          await this.redis!.del(this.cacheKey(tenantId, sid, period)).catch(() => {});
          await this.redis!.del(this.cacheTsKey(tenantId, sid, period)).catch(() => {});
          await this.redis!.del(this.cacheFingerprintKey(tenantId, sid, period)).catch(() => {});
        }
      }
    } catch (error) {
      this.log('warn', 'Failed to invalidate Redis cache', { error });
    }
  }

  /**
   * Cache health check — returns whether Redis is responsive and has cached data.
   */
  async cacheHealth(): Promise<{
    available: boolean;
    cachedKeys: number;
    message: string;
  }> {
    if (!this.redisAvailable) {
      return { available: false, cachedKeys: 0, message: 'Redis not configured' };
    }
    try {
      // Simple PING check via a get on a known key (non-existent is fine)
      await this.redis!.get(`${this.REDIS_PREFIX}:health`);
      return { available: true, cachedKeys: -1, message: 'Redis responsive' };
    } catch {
      return { available: false, cachedKeys: 0, message: 'Redis connection failed' };
    }
  }

  // =========================================================================
  // Aggregation Computation Engine
  // =========================================================================

  computeAggregation(
    evidence: Array<{
      suiteId: string;
      suiteName: string;
      tenantId: string;
      workspaceId: string;
      blueprintId?: string;
      totalChecks: number;
      passedChecks: number;
      failedChecks: number;
      blockedChecks: number;
      passRate: number;
      averageScore: number;
      loopCount: number;
    }>,
    period: string,
  ): Array<{
    tenantId: string;
    workspaceId: string;
    suiteId: string;
    blueprintId?: string;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    blockedChecks: number;
    passRate: number;
    averageScore: number;
    loopCount: number;
    trendDelta?: number;
    period: string;
    capturedAt: string;
  }> {
    const now = new Date().toISOString();
    const results: ReturnType<typeof this.computeAggregation> = [];

    // Group by tenant + suite + period
    const grouped = new Map<string, typeof evidence>();
    for (const item of evidence) {
      const key = `${item.tenantId}:${item.suiteId}:${period}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }

    for (const [, items] of grouped) {
      const totalChecks = items.reduce((s, i) => s + i.totalChecks, 0);
      const passedChecks = items.reduce((s, i) => s + i.passedChecks, 0);
      const failedChecks = items.reduce((s, i) => s + i.failedChecks, 0);
      const blockedChecks = items.reduce((s, i) => s + i.blockedChecks, 0);
      const passRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 10000) / 100 : 0;
      const averageScore =
        items.length > 0
          ? Math.round((items.reduce((s, i) => s + i.averageScore, 0) / items.length) * 100) / 100
          : 0;
      const loopCount = items.reduce((s, i) => s + i.loopCount, 0);
      const primary = items[0];

      results.push({
        tenantId: primary.tenantId,
        workspaceId: primary.workspaceId,
        suiteId: primary.suiteId,
        blueprintId: primary.blueprintId,
        totalChecks,
        passedChecks,
        failedChecks,
        blockedChecks,
        passRate,
        averageScore,
        loopCount,
        period,
        capturedAt: now,
      });
    }
    return results;
  }

  computeTrendDelta(
    current: { passRate: number; averageScore: number },
    previous: { passRate: number; averageScore: number } | null,
  ): number | undefined {
    if (!previous) return undefined;
    return (
      Math.round(
        (current.passRate - previous.passRate + (current.averageScore - previous.averageScore)) *
          100,
      ) / 200
    );
  }

  computeFingerprint(data: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
  }

  // =========================================================================
  // Logging
  // =========================================================================

  log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    this.logger[level](`[EvalAgg] ${message}`, meta);
  }
}
