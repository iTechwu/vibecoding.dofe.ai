import { Inject, Injectable, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createSign } from 'crypto';

export type LoopsPrProvider = 'github' | 'gitlab' | 'gitea';

export type LoopsPrProviderConfig = {
  provider?: LoopsPrProvider;
  apiBaseUrl?: string;
  repository?: string;
  token?: string;
  tokenSecretRef?: string;
  githubAppId?: string;
  githubAppInstallationId?: string;
  githubAppPrivateKey?: string;
  githubAppPrivateKeySecretRef?: string;
  tokenSource?: 'token' | 'github-app' | 'secret-ref' | 'missing';
  allowlist: string[];
};

export const LOOPS_PR_PROVIDER_CONFIG = Symbol('LOOPS_PR_PROVIDER_CONFIG');

export type LoopsOpenPrInput = {
  branch: string;
  baseBranch: string;
  title: string;
  body: string;
};

export type LoopsOpenPrResult =
  | {
      opened: true;
      provider: LoopsPrProvider;
      url: string;
      id: string;
    }
  | {
      opened: false;
      reason: string;
      provider?: LoopsPrProvider;
    };

type ProviderResponse = {
  html_url?: unknown;
  web_url?: unknown;
  url?: unknown;
  id?: unknown;
  iid?: unknown;
  number?: unknown;
  token?: unknown;
  expires_at?: unknown;
};

// R5 · gstack/0 — PR Comment types
export type LoopsCreatePrCommentInput = {
  prId: string;
  body: string;
};

export type LoopsCreatePrCommentResult =
  | { created: true; id: string; url: string }
  | { created: false; reason: string };

export type LoopsPublishCheckRunInput = {
  headSha: string;
  name: string;
  title: string;
  summary: string;
  detailsUrl?: string;
  status?: 'queued' | 'in_progress' | 'completed';
  conclusion?:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required';
};

export type LoopsPublishCheckRunResult =
  | { published: true; provider: 'github'; id: string; url?: string }
  | { published: false; provider?: LoopsPrProvider; reason: string };

@Injectable()
export class LoopsPrProviderClient {
  private githubInstallationTokenCache?: {
    token: string;
    expiresAtMs: number;
  };

  constructor(
    @Optional()
    @Inject(LOOPS_PR_PROVIDER_CONFIG)
    private readonly config: LoopsPrProviderConfig = readPrProviderConfig(),
    @Optional()
    private readonly httpService?: HttpService,
  ) {}

  async openPullRequest(input: LoopsOpenPrInput): Promise<LoopsOpenPrResult> {
    const missing = this.missingConfig();
    if (missing) {
      return { opened: false, reason: missing, provider: this.config.provider };
    }

    const provider = this.config.provider;
    const repository = this.config.repository;
    if (!provider || !repository || !this.config.apiBaseUrl || !this.hasAuthMaterial()) {
      return { opened: false, reason: 'provider config incomplete', provider };
    }

    if (!this.isAllowedRepository(repository)) {
      return { opened: false, reason: 'repository not allowlisted', provider };
    }

    const headers = await this.authHeaders(provider);
    if (!headers) {
      return { opened: false, reason: this.authMissingReason(), provider };
    }

    const data = await this.postJson(
      this.endpoint(provider, repository),
      this.payload(provider, input),
      headers,
    );
    if (!data) {
      return { opened: false, reason: 'provider api request failed', provider };
    }
    if (data.status < 200 || data.status >= 300) {
      return { opened: false, reason: `provider api returned ${data.status}`, provider };
    }

    const body = data.body as ProviderResponse;
    const url = this.extractUrl(body);
    if (!url) {
      return { opened: false, reason: 'provider response missing url', provider };
    }

    return {
      opened: true,
      provider,
      url,
      id: this.extractId(body) ?? url,
    };
  }

  /**
   * Perform the provider POST via @nestjs/axios HttpService (Rule 3) when wired
   * by the Nest container; fall back to global `fetch` only for standalone
   * (ts-node / non-Nest) consumers. `validateStatus: () => true` keeps non-2xx
   * responses from throwing so the caller can map status codes to outcomes.
   */
  private async postJson(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: unknown } | undefined> {
    try {
      if (this.httpService) {
        const response = await firstValueFrom(
          this.httpService.post(url, payload, {
            headers,
            timeout: 15_000,
            validateStatus: () => true,
          }),
        );
        return { status: response.status, body: response.data };
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        return { status: response.status, body: undefined };
      }
      return { status: response.status, body: await response.json() };
    } catch {
      return undefined;
    }
  }

  private missingConfig(): string | undefined {
    if (!this.config.provider) return 'LOOPS_PR_PROVIDER not configured';
    if (!this.config.apiBaseUrl) return 'LOOPS_PR_API_BASE_URL not configured';
    if (!this.config.repository) return 'LOOPS_PR_REPOSITORY not configured';
    if (!this.hasAuthMaterial()) return this.authMissingReason();
    return undefined;
  }

  private isAllowedRepository(repository: string): boolean {
    return this.config.allowlist.length === 0 || this.config.allowlist.includes(repository);
  }

  private endpoint(provider: LoopsPrProvider, repository: string): string {
    const baseUrl = this.config.apiBaseUrl?.replace(/\/+$/, '') ?? '';
    const encodedRepo = encodeURIComponent(repository);
    if (provider === 'gitlab') {
      return `${baseUrl}/projects/${encodedRepo}/merge_requests`;
    }
    if (provider === 'gitea') {
      return `${baseUrl}/repos/${repository}/pulls`;
    }
    return `${baseUrl}/repos/${repository}/pulls`;
  }

  private headers(provider: LoopsPrProvider, token: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (provider === 'gitlab') {
      headers['PRIVATE-TOKEN'] = token;
    } else {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  private async authHeaders(
    provider: LoopsPrProvider,
  ): Promise<Record<string, string> | undefined> {
    const token = await this.resolveAuthToken(provider);
    return token ? this.headers(provider, token) : undefined;
  }

  private async resolveAuthToken(provider: LoopsPrProvider): Promise<string | undefined> {
    const staticToken = this.config.token ?? this.resolveSecretRef(this.config.tokenSecretRef);
    if (staticToken) return staticToken;
    if (provider === 'github') {
      return this.resolveGithubInstallationToken();
    }
    return undefined;
  }

  private hasAuthMaterial(): boolean {
    if (this.config.token || this.config.tokenSecretRef) return true;
    return Boolean(
      this.config.provider === 'github' &&
      this.config.githubAppId &&
      this.config.githubAppInstallationId &&
      (this.config.githubAppPrivateKey || this.config.githubAppPrivateKeySecretRef),
    );
  }

  private authMissingReason(): string {
    if (this.config.provider === 'github' && this.config.githubAppInstallationId) {
      return 'GitHub App auth requires LOOPS_GITHUB_APP_ID and private key material';
    }
    return 'LOOPS_PR_TOKEN not configured';
  }

  private resolveSecretRef(secretRef: string | undefined): string | undefined {
    return secretRef ? process.env[secretRef] : undefined;
  }

  private async resolveGithubInstallationToken(): Promise<string | undefined> {
    const cached = this.githubInstallationTokenCache;
    if (cached && cached.expiresAtMs - Date.now() > 60_000) {
      return cached.token;
    }
    if (
      this.config.provider !== 'github' ||
      !this.config.githubAppId ||
      !this.config.githubAppInstallationId
    ) {
      return undefined;
    }
    const privateKey =
      this.config.githubAppPrivateKey ??
      this.resolveSecretRef(this.config.githubAppPrivateKeySecretRef);
    if (!privateKey) return undefined;

    const baseUrl = this.config.apiBaseUrl?.replace(/\/+$/, '');
    if (!baseUrl) return undefined;
    const jwt = this.createGithubAppJwt(this.config.githubAppId, privateKey);
    if (!jwt) return undefined;
    const data = await this.postJson(
      `${baseUrl}/app/installations/${this.config.githubAppInstallationId}/access_tokens`,
      {},
      {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    );
    if (!data || data.status < 200 || data.status >= 300) {
      return undefined;
    }
    const body = data.body as ProviderResponse;
    if (typeof body.token !== 'string' || !body.token) {
      return undefined;
    }
    const expiresAt =
      typeof body.expires_at === 'string' ? Date.parse(body.expires_at) : Date.now() + 10 * 60_000;
    this.githubInstallationTokenCache = {
      token: body.token,
      expiresAtMs: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 10 * 60_000,
    };
    return body.token;
  }

  private createGithubAppJwt(appId: string, privateKey: string): string | undefined {
    const nowSec = Math.floor(Date.now() / 1000);
    const header = this.base64UrlJson({ alg: 'RS256', typ: 'JWT' });
    const payload = this.base64UrlJson({
      iat: nowSec - 60,
      exp: nowSec + 9 * 60,
      iss: appId,
    });
    const signingInput = `${header}.${payload}`;
    try {
      const signature = createSign('RSA-SHA256').update(signingInput).sign(privateKey);
      return `${signingInput}.${this.base64Url(signature)}`;
    } catch {
      return undefined;
    }
  }

  private base64UrlJson(value: Record<string, unknown>): string {
    return this.base64Url(Buffer.from(JSON.stringify(value)));
  }

  private base64Url(value: Buffer): string {
    return value.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  private payload(provider: LoopsPrProvider, input: LoopsOpenPrInput): Record<string, string> {
    if (provider === 'gitlab') {
      return {
        source_branch: input.branch,
        target_branch: input.baseBranch,
        title: input.title,
        description: input.body,
      };
    }
    return {
      head: input.branch,
      base: input.baseBranch,
      title: input.title,
      body: input.body,
    };
  }

  private extractUrl(data: ProviderResponse): string | undefined {
    for (const candidate of [data.html_url, data.web_url, data.url]) {
      if (typeof candidate === 'string' && candidate.startsWith('http')) {
        return candidate;
      }
    }
    return undefined;
  }

  private extractId(data: ProviderResponse): string | undefined {
    for (const candidate of [data.id, data.iid, data.number]) {
      if (typeof candidate === 'string' || typeof candidate === 'number') {
        return String(candidate);
      }
    }
    return undefined;
  }

  // --------------------------------------------------------------------------
  // PR Comment (R5 · gstack/0)
  // --------------------------------------------------------------------------

  /**
   * Create a comment on an existing PR. Reuses the same provider auth config
   * as openPullRequest. Returns the comment id and url on success.
   */
  async createPrComment(input: LoopsCreatePrCommentInput): Promise<LoopsCreatePrCommentResult> {
    const missing = this.missingConfig();
    if (missing) return { created: false, reason: missing };

    const provider = this.config.provider!;
    const repository = this.config.repository!;
    const baseUrl = this.config.apiBaseUrl!.replace(/\/+$/, '');
    const encodedRepo = encodeURIComponent(repository);

    let url: string;
    if (provider === 'gitlab') {
      url = `${baseUrl}/projects/${encodedRepo}/merge_requests/${input.prId}/notes`;
    } else if (provider === 'gitea') {
      url = `${baseUrl}/repos/${repository}/issues/${input.prId}/comments`;
    } else {
      url = `${baseUrl}/repos/${repository}/issues/${input.prId}/comments`;
    }

    const headers = await this.authHeaders(provider);
    if (!headers) return { created: false, reason: this.authMissingReason() };
    const data = await this.postJson(url, { body: input.body }, headers);
    if (!data || data.status < 200 || data.status >= 300) {
      return { created: false, reason: `provider api returned ${data?.status ?? 'error'}` };
    }

    const body = data.body as ProviderResponse & { html_url?: string; id?: number };
    const commentUrl = body.html_url ?? '';
    const commentId = this.extractId(body) ?? commentUrl;
    return { created: true, id: commentId, url: commentUrl };
  }

  /**
   * Update (edit) an existing PR comment. Currently only GitHub supports
   * this via PATCH; GitLab supports PUT. Returns updated comment id.
   */
  async updatePrComment(commentId: string, body: string): Promise<LoopsCreatePrCommentResult> {
    const missing = this.missingConfig();
    if (missing) return { created: false, reason: missing };

    const provider = this.config.provider!;
    const repository = this.config.repository!;
    const baseUrl = this.config.apiBaseUrl!.replace(/\/+$/, '');
    const encodedRepo = encodeURIComponent(repository);

    let url: string;
    if (provider === 'gitlab') {
      url = `${baseUrl}/projects/${encodedRepo}/merge_requests/notes/${commentId}`;
    } else {
      // GitHub and Gitea use issues comments endpoint
      url = `${baseUrl}/repos/${repository}/issues/comments/${commentId}`;
    }

    const headers = await this.authHeaders(provider);
    if (!headers) return { created: false, reason: this.authMissingReason() };
    // GitHub/GitLab use PATCH, Gitea might need PUT
    const method = provider === 'gitea' ? 'PUT' : 'PATCH';
    const data =
      method === 'PATCH'
        ? await this.patchJson(url, { body }, headers)
        : await this.putJson(url, { body }, headers);

    if (!data || data.status < 200 || data.status >= 300) {
      return { created: false, reason: `provider api returned ${data?.status ?? 'error'}` };
    }
    return { created: true, id: commentId, url: '' };
  }

  async publishGithubCheckRun(
    input: LoopsPublishCheckRunInput,
  ): Promise<LoopsPublishCheckRunResult> {
    const missing = this.missingConfig();
    if (missing) return { published: false, reason: missing, provider: this.config.provider };
    if (this.config.provider !== 'github') {
      return {
        published: false,
        provider: this.config.provider,
        reason: 'GitHub Checks API requires LOOPS_PR_PROVIDER=github',
      };
    }

    const repository = this.config.repository!;
    if (!this.isAllowedRepository(repository)) {
      return { published: false, provider: 'github', reason: 'repository not allowlisted' };
    }

    const baseUrl = this.config.apiBaseUrl!.replace(/\/+$/, '');
    const url = `${baseUrl}/repos/${repository}/check-runs`;
    const authHeaders = await this.authHeaders('github');
    if (!authHeaders) {
      return { published: false, provider: 'github', reason: this.authMissingReason() };
    }
    const headers = {
      ...authHeaders,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const status = input.status ?? 'completed';
    const payload: Record<string, unknown> = {
      name: input.name,
      head_sha: input.headSha,
      status,
      output: {
        title: input.title,
        summary: input.summary,
      },
    };
    if (input.detailsUrl) payload.details_url = input.detailsUrl;
    if (status === 'completed') payload.conclusion = input.conclusion ?? 'success';

    const data = await this.postJson(url, payload, headers);
    if (!data || data.status < 200 || data.status >= 300) {
      return {
        published: false,
        provider: 'github',
        reason: `provider api returned ${data?.status ?? 'error'}`,
      };
    }

    const body = data.body as ProviderResponse;
    return {
      published: true,
      provider: 'github',
      id: this.extractId(body) ?? input.headSha,
      url: this.extractUrl(body),
    };
  }

  private async patchJson(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: unknown } | undefined> {
    try {
      if (this.httpService) {
        const response = await firstValueFrom(
          this.httpService.patch(url, payload, {
            headers,
            timeout: 15_000,
            validateStatus: () => true,
          }),
        );
        return { status: response.status, body: response.data };
      }
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      return { status: response.status, body: await response.json().catch(() => undefined) };
    } catch {
      return undefined;
    }
  }

  private async putJson(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: unknown } | undefined> {
    try {
      if (this.httpService) {
        const response = await firstValueFrom(
          this.httpService.put(url, payload, {
            headers,
            timeout: 15_000,
            validateStatus: () => true,
          }),
        );
        return { status: response.status, body: response.data };
      }
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      return { status: response.status, body: await response.json().catch(() => undefined) };
    } catch {
      return undefined;
    }
  }
}

export function readPrProviderConfig(env: NodeJS.ProcessEnv = process.env): LoopsPrProviderConfig {
  const token = env.LOOPS_PR_TOKEN;
  const githubAppId = env.LOOPS_GITHUB_APP_ID;
  const githubAppInstallationId = env.LOOPS_GITHUB_APP_INSTALLATION_ID;
  const githubAppPrivateKey = normalizePrivateKey(env.LOOPS_GITHUB_APP_PRIVATE_KEY);
  const githubAppPrivateKeySecretRef = env.LOOPS_GITHUB_APP_PRIVATE_KEY_SECRET_REF;
  const tokenSecretRef = env.LOOPS_PR_TOKEN_SECRET_REF;
  return {
    provider: parseProvider(env.LOOPS_PR_PROVIDER),
    apiBaseUrl: env.LOOPS_PR_API_BASE_URL,
    repository: env.LOOPS_PR_REPOSITORY,
    token,
    tokenSecretRef,
    githubAppId,
    githubAppInstallationId,
    githubAppPrivateKey,
    githubAppPrivateKeySecretRef,
    tokenSource: resolveTokenSource({
      token,
      tokenSecretRef,
      githubAppId,
      githubAppInstallationId,
      githubAppPrivateKey,
      githubAppPrivateKeySecretRef,
    }),
    allowlist: parseCsv(env.LOOPS_PR_REPOSITORY_ALLOWLIST),
  };
}

function parseProvider(value: string | undefined): LoopsPrProvider | undefined {
  return value === 'github' || value === 'gitlab' || value === 'gitea' ? value : undefined;
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveTokenSource(input: {
  token?: string;
  tokenSecretRef?: string;
  githubAppId?: string;
  githubAppInstallationId?: string;
  githubAppPrivateKey?: string;
  githubAppPrivateKeySecretRef?: string;
}): LoopsPrProviderConfig['tokenSource'] {
  if (input.token) return 'token';
  if (input.tokenSecretRef) return 'secret-ref';
  if (
    input.githubAppId &&
    input.githubAppInstallationId &&
    (input.githubAppPrivateKey || input.githubAppPrivateKeySecretRef)
  ) {
    return 'github-app';
  }
  return 'missing';
}

function normalizePrivateKey(value: string | undefined): string | undefined {
  return value?.replace(/\\n/g, '\n');
}
