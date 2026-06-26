import { Injectable, Optional } from '@nestjs/common';
import type { LoopIssuesQuery } from '@repo/contracts';
import { LoopsEvidenceService } from '@app/services/loops-evidence';
import { LoopsIssuesService } from '@app/services/loops-issues';
import { type LoopsArchiveCollectionPort, type LoopsArchivePeriod } from './loops-admin.service';

export interface LoopsArchiveEvalAggregationPort {
  getCrossTenantEvalAggregation(input: {
    tenantId: string;
    period: LoopsArchivePeriod;
    limit: number;
    page: number;
  }): Promise<{ aggregations: unknown[] }>;
}

/**
 * Archive collection adapter for cross-tenant archive manifests.
 *
 * It owns the loop detail/list read shape required by archive creation without
 * depending on the legacy API facade. Eval aggregation remains behind a narrow
 * optional port until Step N4 moves worker IO fully into `loops-eval`.
 */
@Injectable()
export class LoopsArchiveCollectionService implements LoopsArchiveCollectionPort {
  constructor(
    private readonly issues: LoopsIssuesService,
    private readonly evidence: LoopsEvidenceService,
    @Optional()
    private readonly evalAggregationPort?: LoopsArchiveEvalAggregationPort,
  ) {}

  list(
    query: LoopIssuesQuery,
  ): Promise<{ list: Array<{ issue: { id: string; status?: string } }> }> {
    return this.issues.list(query, async (result) => result);
  }

  getIssue(issueId: string): Promise<{
    issue: unknown;
    state?: unknown;
    shards?: unknown[];
    testRecords?: unknown[];
    reviewRecords?: unknown[];
    implementationRecords?: unknown[];
  }> {
    return this.issues.getIssue(issueId, (detail) =>
      this.evidence.withRequirementsCoverage(detail, this.evidence.buildSecondOpinion(detail)),
    );
  }

  async getCrossTenantEvalAggregation(input: {
    tenantId: string;
    period: LoopsArchivePeriod;
    limit: number;
    page: number;
  }): Promise<{ aggregations: unknown[] }> {
    if (!this.evalAggregationPort) {
      return { aggregations: [] };
    }
    return this.evalAggregationPort.getCrossTenantEvalAggregation(input);
  }
}
