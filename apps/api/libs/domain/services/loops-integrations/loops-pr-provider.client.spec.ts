import { generateKeyPairSync } from 'crypto';
import { of } from 'rxjs';
import { LoopsPrProviderClient, readPrProviderConfig } from './loops-pr-provider.client';

type HttpServiceLike = { post: jest.Mock };

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
      tokenSecretRef: undefined,
      githubAppId: undefined,
      githubAppInstallationId: undefined,
      githubAppPrivateKey: undefined,
      githubAppPrivateKeySecretRef: undefined,
      tokenSource: 'token',
      allowlist: ['dofe/repo', 'other/repo'],
    });
  });

  it('tracks GitHub App installation and secret references without exposing secret values', () => {
    expect(
      readPrProviderConfig({
        LOOPS_PR_PROVIDER: 'github',
        LOOPS_PR_API_BASE_URL: 'https://api.github.com',
        LOOPS_PR_REPOSITORY: 'dofe/repo',
        LOOPS_GITHUB_APP_ID: '12345',
        LOOPS_GITHUB_APP_INSTALLATION_ID: '98765',
        LOOPS_GITHUB_APP_PRIVATE_KEY_SECRET_REF: 'LOOPS_GITHUB_APP_PRIVATE_KEY',
        LOOPS_PR_REPOSITORY_ALLOWLIST: 'dofe/repo',
      }),
    ).toEqual({
      provider: 'github',
      apiBaseUrl: 'https://api.github.com',
      repository: 'dofe/repo',
      token: undefined,
      tokenSecretRef: undefined,
      githubAppId: '12345',
      githubAppInstallationId: '98765',
      githubAppPrivateKey: undefined,
      githubAppPrivateKeySecretRef: 'LOOPS_GITHUB_APP_PRIVATE_KEY',
      tokenSource: 'github-app',
      allowlist: ['dofe/repo'],
    });
  });

  describe('HttpService path (production / Rule 3)', () => {
    it('opens a PR via HttpService on a 2xx response', async () => {
      const httpService: HttpServiceLike = {
        post: jest.fn().mockReturnValue(
          of({
            status: 201,
            data: { html_url: 'https://github.com/dofe/repo/pull/7', number: 7 },
          }),
        ),
      };
      const client = new LoopsPrProviderClient(
        {
          provider: 'github',
          apiBaseUrl: 'https://api.github.com',
          repository: 'dofe/repo',
          token: 'token',
          allowlist: ['dofe/repo'],
        },
        httpService as never,
      );

      const result = await client.openPullRequest({
        branch: 'loops/issue-1',
        baseBranch: 'main',
        title: 'Loops issue-1',
        body: 'PR body',
      });

      expect(result).toEqual({
        opened: true,
        provider: 'github',
        url: 'https://github.com/dofe/repo/pull/7',
        id: '7',
      });
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.github.com/repos/dofe/repo/pulls',
        expect.objectContaining({ head: 'loops/issue-1' }),
        expect.objectContaining({ validateStatus: expect.any(Function) }),
      );
    });

    it('maps a non-2xx HttpService response to opened:false without throwing', async () => {
      const httpService: HttpServiceLike = {
        post: jest.fn().mockReturnValue(of({ status: 422, data: {} })),
      };
      const client = new LoopsPrProviderClient(
        {
          provider: 'github',
          apiBaseUrl: 'https://api.github.com',
          repository: 'dofe/repo',
          token: 'token',
          allowlist: ['dofe/repo'],
        },
        httpService as never,
      );

      const result = await client.openPullRequest({
        branch: 'loops/issue-1',
        baseBranch: 'main',
        title: 'Loops issue-1',
        body: 'PR body',
      });

      expect(result).toEqual({
        opened: false,
        reason: 'provider api returned 422',
        provider: 'github',
      });
    });

    it('publishes a GitHub Check Run via HttpService', async () => {
      const httpService: HttpServiceLike = {
        post: jest.fn().mockReturnValue(
          of({
            status: 201,
            data: { html_url: 'https://github.com/dofe/repo/runs/11', id: 11 },
          }),
        ),
      };
      const client = new LoopsPrProviderClient(
        {
          provider: 'github',
          apiBaseUrl: 'https://api.github.com',
          repository: 'dofe/repo',
          token: 'token',
          allowlist: ['dofe/repo'],
        },
        httpService as never,
      );

      const result = await client.publishGithubCheckRun({
        headSha: 'abc1234567',
        name: 'DofeAI Delivery Evidence',
        title: 'Delivery evidence passed',
        summary: 'All required Loops evidence is present.',
      });

      expect(result).toEqual({
        published: true,
        provider: 'github',
        id: '11',
        url: 'https://github.com/dofe/repo/runs/11',
      });
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.github.com/repos/dofe/repo/check-runs',
        expect.objectContaining({
          name: 'DofeAI Delivery Evidence',
          head_sha: 'abc1234567',
          status: 'completed',
          conclusion: 'success',
          output: {
            title: 'Delivery evidence passed',
            summary: 'All required Loops evidence is present.',
          },
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/vnd.github+json',
            Authorization: 'Bearer token',
          }),
          validateStatus: expect.any(Function),
        }),
      );
    });

    it('exchanges a GitHub App JWT for an installation token before publishing Checks', async () => {
      const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
      const httpService: HttpServiceLike = {
        post: jest
          .fn()
          .mockReturnValueOnce(
            of({
              status: 201,
              data: {
                token: 'installation-token',
                expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
              },
            }),
          )
          .mockReturnValueOnce(
            of({
              status: 201,
              data: { html_url: 'https://github.com/dofe/repo/runs/22', id: 22 },
            }),
          ),
      };
      const client = new LoopsPrProviderClient(
        {
          provider: 'github',
          apiBaseUrl: 'https://api.github.com',
          repository: 'dofe/repo',
          githubAppId: '12345',
          githubAppInstallationId: '98765',
          githubAppPrivateKey: privateKeyPem,
          tokenSource: 'github-app',
          allowlist: ['dofe/repo'],
        },
        httpService as never,
      );

      const result = await client.publishGithubCheckRun({
        headSha: 'abc1234567',
        name: 'DofeAI Delivery Evidence',
        title: 'Delivery evidence passed',
        summary: 'All required Loops evidence is present.',
      });

      expect(result).toEqual({
        published: true,
        provider: 'github',
        id: '22',
        url: 'https://github.com/dofe/repo/runs/22',
      });
      expect(httpService.post).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/app/installations/98765/access_tokens',
        {},
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/vnd.github+json',
            Authorization: expect.stringMatching(/^Bearer [^.]+\.[^.]+\.[^.]+$/),
          }),
        }),
      );
      expect(httpService.post).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/dofe/repo/check-runs',
        expect.objectContaining({ head_sha: 'abc1234567' }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer installation-token',
          }),
        }),
      );
    });
  });
});
