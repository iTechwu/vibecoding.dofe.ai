import {
  enrichLoopLearning,
  withLearningSimilaritySuggestions,
} from './loops-learning-memory.util';

describe('learning memory enrichment', () => {
  it('adds stable fingerprints, tags, and similarity suggestions', () => {
    const first = enrichLoopLearning({
      id: 'learning-a',
      workspaceId: 'default',
      repo: '/repo/app',
      kind: 'test_policy',
      summary: 'Run unit and type-check before dashboard changes.',
      evidenceIds: ['test-1'],
      confidence: 0.9,
      createdAt: '2026-06-23T00:00:00.000Z',
    });
    const enriched = withLearningSimilaritySuggestions([
      first,
      {
        id: 'learning-b',
        workspaceId: 'default',
        repo: '/repo/app',
        kind: 'test_policy',
        summary: 'Run unit tests and type-check before changing dashboard UI.',
        evidenceIds: ['test-2'],
        confidence: 0.8,
        createdAt: '2026-06-23T00:01:00.000Z',
      },
      {
        id: 'learning-c',
        workspaceId: 'default',
        repo: '/repo/docs',
        kind: 'ownership',
        summary: 'Docs changes usually touch docs/0623/gstack.',
        evidenceIds: ['impl-1'],
        confidence: 0.7,
        createdAt: '2026-06-23T00:02:00.000Z',
      },
    ]);

    expect(first.fingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(first.tags).toEqual(expect.arrayContaining(['test', 'policy', 'dashboard']));
    expect(enriched.find((learning) => learning.id === 'learning-a')?.similarLearningIds).toEqual([
      'learning-b',
    ]);
  });
});
