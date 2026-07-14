import { describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ redirect }));

import AgentRuntimePage from './page';

describe('AgentRuntimePage', () => {
  it('redirects the documented deep link to the dashboard runtime panel', () => {
    AgentRuntimePage();

    expect(redirect).toHaveBeenCalledWith('/loops?view=operations#agent-runtime');
  });
});
