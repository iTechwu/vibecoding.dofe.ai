import { LoopsIssuesService } from './loops-issues.service';

describe('LoopsIssuesService.createIssue orchestration', () => {
  function buildService(evidenceOverrides: { inferWorkflowKind?: jest.Mock } = {}) {
    const store = {
      intakeId: jest.fn((id: string) => `${id}-intake`),
      readWorkflowDefaults: jest.fn().mockResolvedValue([]),
      writeIssue: jest.fn(),
    };
    const evidence = {
      inferWorkflowKind:
        evidenceOverrides.inferWorkflowKind ?? jest.fn().mockReturnValue('feature'),
      buildWorkflowRecipe: jest.fn().mockReturnValue({
        id: 'default-feature@v1',
        name: 'Feature',
        version: 1,
        appliesTo: ['feature'],
        baselineEvidence: [],
        steps: [],
      }),
    };
    const service = new LoopsIssuesService(store as never, undefined, undefined, evidence as never);
    jest.spyOn(service, 'resolveTargetRepo').mockResolvedValue('/repo');
    jest.spyOn(service, 'normalizeSubmitter').mockReturnValue({
      provider: 'web',
      userId: 'submitter-1',
      name: 'Submitter',
    });
    jest.spyOn(service, 'captureRuleSnapshot').mockResolvedValue({ rules: [], evidence: [] });
    jest.spyOn(service, 'writeIssueRecord').mockResolvedValue(undefined);
    return { service, store, evidence };
  }

  const baseInput = {
    title: 'Add delivery evidence export',
    targetRepo: '.',
    body: 'Export delivery evidence markdown for closed loops.',
    priority: 'P2' as const,
    acceptanceCriteria: ['evidence markdown is exported'],
  };

  it('assembles issue/intake/state and derives a loop-snapshot recipe when no workspace default matches', async () => {
    const { service, evidence } = buildService();

    const result = await service.createIssue(baseInput);

    expect(result.issue).toEqual(
      expect.objectContaining({
        status: 'OPEN',
        priority: 'P2',
        sourceChannel: 'web',
        sourceKind: 'web_form',
        targetRepo: '/repo',
        submitterId: 'submitter-1',
      }),
    );
    expect(result.issue.id).toMatch(/^issue-\d{8}-[a-f0-9]{8}$/);
    expect(result.state).toEqual(
      expect.objectContaining({
        phase: 'PHASE_1_SPEC',
        round: 1,
        specVersion: 'v0',
        paused: false,
      }),
    );

    expect(service.writeIssueRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        issue: expect.objectContaining({ id: result.issue.id }),
        rawPayload: baseInput,
        workflowRecipe: expect.objectContaining({
          source: 'loop-snapshot',
          capturedAt: expect.any(String),
        }),
      }),
    );
    expect(evidence.inferWorkflowKind).toHaveBeenCalledWith({ issue: result.issue });
    expect(evidence.buildWorkflowRecipe).toHaveBeenCalled();
  });

  it('applies the workspace default recipe id when a matching loopKind default exists', async () => {
    const { service, store } = buildService({
      inferWorkflowKind: jest.fn().mockReturnValue('bugfix'),
    });
    store.readWorkflowDefaults.mockResolvedValue([
      { loopKind: 'bugfix', recipeId: 'workspace-bugfix-recipe' },
    ]);

    await service.createIssue(baseInput);

    const [record] = (service.writeIssueRecord as jest.Mock).mock.calls[0];
    expect(record.workflowRecipe).toEqual(
      expect.objectContaining({
        id: 'workspace-bugfix-recipe',
        source: 'workspace',
      }),
    );
  });

  it('honours an explicit sourceChannel/sourceKind and authUser submitter', async () => {
    const { service } = buildService();

    await service.createIssue({
      ...baseInput,
      sourceChannel: 'schedule',
      sourceKind: 'schedule',
    });

    expect(service.normalizeSubmitter).toHaveBeenCalled();
    const [record] = (service.writeIssueRecord as jest.Mock).mock.calls[0];
    expect(record.issue.sourceChannel).toBe('schedule');
    expect(record.issue.sourceKind).toBe('schedule');
    expect(record.intake.sourceChannel).toBe('schedule');
  });

  it('persists tenant context on issue, intake, and raw payload', async () => {
    const { service } = buildService();

    await service.createIssue({
      ...baseInput,
      tenantContext: {
        tenantId: 'tenant-youhuitun',
        tenantName: '优惠豚',
        teamId: 'team-1',
      },
    });

    const [record] = (service.writeIssueRecord as jest.Mock).mock.calls[0];
    expect(record.issue.tenantContext).toEqual({
      tenantId: 'tenant-youhuitun',
      tenantName: '优惠豚',
      teamId: 'team-1',
    });
    expect(record.intake.tenantContext).toEqual(record.issue.tenantContext);
    expect(record.rawPayload).toEqual(
      expect.objectContaining({
        tenantContext: record.issue.tenantContext,
      }),
    );
  });

  it('throws when evidence is not wired', async () => {
    const store = { intakeId: jest.fn(), readWorkflowDefaults: jest.fn(), writeIssue: jest.fn() };
    const service = new LoopsIssuesService(store as never, undefined, undefined, undefined);
    await expect(service.createIssue(baseInput)).rejects.toThrow('LoopsEvidenceService');
  });
});
