import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LoopsFileStoreService } from './loops-file-store.service';
import type { LoopStateItem } from '@repo/contracts';

function baseState(overrides: Partial<LoopStateItem> = {}): LoopStateItem {
  return {
    issueId: 'issue-cost-1',
    phase: 'PHASE_4_IMPLEMENT',
    round: 1,
    specVersion: 'v1',
    shardsTotal: 2,
    shardsDone: 0,
    shardsInProgress: 0,
    reloopCount: 0,
    costTokens: 0,
    costCalls: 0,
    updated: '2026-06-21T00:00:00.000Z',
    paused: false,
    ...overrides,
  };
}

describe('LoopsFileStoreService.enforceCostGuard (R13)', () => {
  const previousWorkspaceRoot = process.env.LOOPS_WORKSPACE_ROOT;
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'loops-cost-'));
    process.env.LOOPS_WORKSPACE_ROOT = workspace;
  });

  afterEach(() => {
    if (previousWorkspaceRoot === undefined) delete process.env.LOOPS_WORKSPACE_ROOT;
    else process.env.LOOPS_WORKSPACE_ROOT = previousWorkspaceRoot;
    rmSync(workspace, { recursive: true, force: true });
  });

  it('leaves the loop running when usage is below the default cap', async () => {
    const store = new LoopsFileStoreService();
    const result = await store.enforceCostGuard(baseState({ costCalls: 10, costTokens: 1000 }));
    expect(result.paused).toBe(false);
    expect(result.phase).toBe('PHASE_4_IMPLEMENT');
  });

  it('trips (PAUSED) when call usage reaches the default callCapPerLoop (500)', async () => {
    const store = new LoopsFileStoreService();
    await store.ensureInitialized();
    const result = await store.enforceCostGuard(baseState({ costCalls: 500 }));
    expect(result.paused).toBe(true);
    expect(result.phase).toBe('PAUSED');
  });

  it('trips (PAUSED) when token usage reaches the default tokenCapPerLoop (5_000_000)', async () => {
    const store = new LoopsFileStoreService();
    await store.ensureInitialized();
    const result = await store.enforceCostGuard(baseState({ costTokens: 5_000_000 }));
    expect(result.paused).toBe(true);
    expect(result.phase).toBe('PAUSED');
  });
});
