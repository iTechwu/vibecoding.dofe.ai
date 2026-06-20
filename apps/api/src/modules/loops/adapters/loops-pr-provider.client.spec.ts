import { LoopsPrProviderClient, readPrProviderConfig } from './loops-pr-provider.client';

describe('LoopsPrProviderClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('opens a GitHub pull request when provider config is complete and allowlisted', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        html_url: 'https://github.com/dofe/repo/pull/42',
        number: 42,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new LoopsPrProviderClient({
      provider: 'github',
      apiBaseUrl: 'https://api.github.com',
      repository: 'dofe/repo',
      token: 'token',
      allowlist: ['dofe/repo'],
    });

    const result = await client.openPullRequest({
      branch: 'loops/issue-1',
      baseBranch: 'main',
      title: 'Loops issue-1',
      body: 'PR body',
    });

    expect(result).toEqual({
      opened: true,
      provider: 'github',
      url: 'https://github.com/dofe/repo/pull/42',
      id: '42',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/dofe/repo/pulls',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          head: 'loops/issue-1',
          base: 'main',
          title: 'Loops issue-1',
          body: 'PR body',
        }),
      }),
    );
  });

  it('skips opening a PR when provider config is incomplete', async () => {
    const client = new LoopsPrProviderClient({
      allowlist: [],
    });

    await expect(
      client.openPullRequest({
        branch: 'loops/issue-1',
        baseBranch: 'main',
        title: 'Loops issue-1',
        body: 'PR body',
      }),
    ).resolves.toEqual({
      opened: false,
      reason: 'LOOPS_PR_PROVIDER not configured',
      provider: undefined,
    });
  });

  it('denies repositories outside the allowlist', async () => {
    const client = new LoopsPrProviderClient({
      provider: 'gitlab',
      apiBaseUrl: 'https://gitlab.example/api/v4',
      repository: 'dofe/repo',
      token: 'token',
      allowlist: ['other/repo'],
    });

    await expect(
      client.openPullRequest({
        branch: 'loops/issue-1',
        baseBranch: 'main',
        title: 'Loops issue-1',
        body: 'PR body',
      }),
    ).resolves.toEqual({
      opened: false,
      reason: 'repository not allowlisted',
      provider: 'gitlab',
    });
  });

  it('reads provider config from environment variables', () => {
    expect(
      readPrProviderConfig({
        LOOPS_PR_PROVIDER: 'gitea',
        LOOPS_PR_API_BASE_URL: 'https://git.example/api/v1',
        LOOPS_PR_REPOSITORY: 'dofe/repo',
        LOOPS_PR_TOKEN: 'token',
        LOOPS_PR_REPOSITORY_ALLOWLIST: 'dofe/repo, other/repo',
      }),
    ).toEqual({
      provider: 'gitea',
      apiBaseUrl: 'https://git.example/api/v1',
      repository: 'dofe/repo',
      token: 'token',
      allowlist: ['dofe/repo', 'other/repo'],
    });
  });
});
