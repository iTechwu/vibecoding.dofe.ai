import { LoopsPersistenceService } from './loops-persistence.service';

/**
 * SSO single-source scope enforcement for the persistence layer.
 *
 * These tests pin the security invariants introduced in Cycle 7 of
 * docs/0712/tenant-team-sso-unique-source:
 *  - A scoped detail read is authorized ONLY through the DB. A tenant mismatch
 *    reads as null and never falls back to the file store (the JSON
 *    `tenantContext` is a display snapshot, not an authorization source).
 *  - `list` pushes the verified scope down to the DB query.
 *  - The file-fallback branch of `list` filters by the verified tenant and
 *    excludes NULL-scope (historical) rows.
 */
describe('LoopsPersistenceService — SSO scope enforcement', () => {
  const dbIssue = {
    id: 'issue-1',
    title: 'title',
    body: 'body',
    status: 'OPEN',
    priority: 'P2',
    sourceChannel: 'web',
    sourceKind: 'web_form',
    submitterProvider: 'dofe-sso',
    submitterId: 'user-1',
    submitterName: 'User',
    tenantId: 'tenant-a',
    teamId: null,
    targetRepo: '.',
    acceptanceCriteria: ['ac'],
    rawPayloadRef: '.loops/intakes/issue-1.raw.json',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  const dbState = {
    issueId: 'issue-1',
    phase: 'PHASE_1_SPEC',
    round: 1,
    specVersion: 'v0',
    shardsTotal: 0,
    shardsDone: 0,
    shardsInProgress: 0,
    reloopCount: 0,
    costTokens: 0,
    costCalls: 0,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    paused: false,
    finalized: false,
    globalVerdict: null,
  };

  function buildService(overrides: {
    db?: Record<string, jest.Mock>;
    store?: Record<string, jest.Mock>;
  }) {
    const db = {
      listIssues: jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, limit: 20 }),
      getIssueDetailByIssueId: jest.fn().mockResolvedValue(null),
      ...(overrides.db ?? {}),
    };
    const store = {
      list: jest.fn().mockResolvedValue({ issues: [], loops: [] }),
      readDetail: jest.fn(),
      ...(overrides.store ?? {}),
    };
    const service = new LoopsPersistenceService(db as never, store as never);
    return { service, db, store };
  }

  it('readDetailScoped returns null when the DB has no tenant-matching row and does NOT touch the file store', async () => {
    const { service, db, store } = buildService({
      db: { getIssueDetailByIssueId: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.readDetailScoped('issue-1', { tenantId: 'tenant-a' })).resolves.toBeNull();

    expect(db.getIssueDetailByIssueId).toHaveBeenCalledWith('issue-1', { tenantId: 'tenant-a' });
    expect(store.readDetail).not.toHaveBeenCalled();
  });

  it('readDetailScoped merges the DB-owned issue with the file tenantContext when the tenant matches', async () => {
    const { service } = buildService({
      db: {
        getIssueDetailByIssueId: jest
          .fn()
          .mockResolvedValue({ issue: dbIssue, intakes: [], state: dbState }),
      },
      store: {
        readDetail: jest.fn().mockResolvedValue({
          issue: { tenantContext: { tenantId: 'tenant-a', tenantName: 'Tenant A' } },
          intake: { ruleSnapshot: undefined, tenantContext: { tenantId: 'tenant-a' } },
        }),
      },
    });

    const detail = await service.readDetailScoped('issue-1', { tenantId: 'tenant-a' });

    expect(detail).not.toBeNull();
    // DB wins for identity fields; file tenantContext is preserved as display snapshot.
    expect(detail?.issue.id).toBe('issue-1');
    expect(detail?.issue.tenantContext).toEqual({ tenantId: 'tenant-a', tenantName: 'Tenant A' });
  });

  it('list pushes the verified scope into the DB query', async () => {
    const { service, db } = buildService({
      db: {
        // hasListFilters(status) → true keeps us on the DB branch.
        listIssues: jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, limit: 20 }),
      },
    });

    await service.list({ status: 'OPEN' } as never, { tenantId: 'tenant-a' });

    expect(db.listIssues).toHaveBeenCalledWith({ status: 'OPEN' }, { tenantId: 'tenant-a' });
  });

  it('list file-fallback branch filters by verified tenant and excludes NULL-scope rows', async () => {
    const issues = [
      {
        id: 'a',
        tenantContext: { tenantId: 'tenant-a' },
        status: 'OPEN',
        priority: 'P2',
        targetRepo: '.',
      },
      {
        id: 'b',
        tenantContext: { tenantId: 'tenant-b' },
        status: 'OPEN',
        priority: 'P2',
        targetRepo: '.',
      },
      { id: 'c', status: 'OPEN', priority: 'P2', targetRepo: '.' },
    ];
    const { service } = buildService({
      store: { list: jest.fn().mockResolvedValue({ issues, loops: [] }) },
    });

    const result = await service.list({} as never, { tenantId: 'tenant-a' });

    expect(result.list.map((item) => item.issue.id)).toEqual(['a']);
    expect(result.total).toBe(1);
  });

  it('list without a scope returns all file rows (additive — behavior unchanged when scope absent)', async () => {
    const issues = [
      {
        id: 'a',
        tenantContext: { tenantId: 'tenant-a' },
        status: 'OPEN',
        priority: 'P2',
        targetRepo: '.',
      },
      { id: 'c', status: 'OPEN', priority: 'P2', targetRepo: '.' },
    ];
    const { service } = buildService({
      store: { list: jest.fn().mockResolvedValue({ issues, loops: [] }) },
    });

    const result = await service.list({} as never);

    expect(result.list.map((item) => item.issue.id)).toEqual(['a', 'c']);
  });
});
