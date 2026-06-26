import { LoopsArchiveCollectionService } from './loops-archive-collection.service';

describe('LoopsArchiveCollectionService', () => {
  it('collects loop list and enriched detail through domain ports', async () => {
    const issues = {
      list: jest.fn().mockImplementation(async (_query, enrich) =>
        enrich({
          list: [{ issue: { id: 'issue-1', status: 'OPEN' } }],
          total: 1,
          page: 1,
          limit: 20,
        }),
      ),
      getIssue: jest.fn().mockImplementation(async (_issueId, enrich) =>
        enrich({
          issue: { id: 'issue-1' },
          state: { phase: 'PHASE_1_INTAKE' },
          shards: [{ id: 'shard-1' }],
          testRecords: [],
          reviewRecords: [],
          implementationRecords: [],
        }),
      ),
    };
    const evidence = {
      buildSecondOpinion: jest.fn().mockReturnValue({ status: 'SKIPPED' }),
      withRequirementsCoverage: jest.fn().mockImplementation((detail) => ({
        ...detail,
        requirementsCoverage: { summary: { total: 0 } },
      })),
    };

    const service = new LoopsArchiveCollectionService(issues as never, evidence as never);

    await expect(service.list({ page: 1, limit: 20 })).resolves.toEqual({
      list: [{ issue: { id: 'issue-1', status: 'OPEN' } }],
      total: 1,
      page: 1,
      limit: 20,
    });

    await expect(service.getIssue('issue-1')).resolves.toEqual(
      expect.objectContaining({
        issue: { id: 'issue-1' },
        requirementsCoverage: { summary: { total: 0 } },
      }),
    );
    expect(evidence.buildSecondOpinion).toHaveBeenCalledWith(
      expect.objectContaining({ issue: { id: 'issue-1' } }),
    );
    expect(evidence.withRequirementsCoverage).toHaveBeenCalled();
  });

  it('uses eval aggregation port when present and falls back to empty aggregation otherwise', async () => {
    const issues = { list: jest.fn(), getIssue: jest.fn() };
    const evidence = { buildSecondOpinion: jest.fn(), withRequirementsCoverage: jest.fn() };
    const evalPort = {
      getCrossTenantEvalAggregation: jest.fn().mockResolvedValue({
        aggregations: [{ id: 'agg-1' }],
      }),
    };
    const service = new LoopsArchiveCollectionService(issues as never, evidence as never, evalPort);
    await expect(
      service.getCrossTenantEvalAggregation({
        tenantId: 'tenant-1',
        period: 'all',
        limit: 100,
        page: 1,
      }),
    ).resolves.toEqual({ aggregations: [{ id: 'agg-1' }] });

    const fallback = new LoopsArchiveCollectionService(issues as never, evidence as never);
    await expect(
      fallback.getCrossTenantEvalAggregation({
        tenantId: 'tenant-1',
        period: 'all',
        limit: 100,
        page: 1,
      }),
    ).resolves.toEqual({ aggregations: [] });
  });
});
