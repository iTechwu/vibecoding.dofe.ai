import { Inject, Injectable, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export type LoopsPrProvider = 'github' | 'gitlab' | 'gitea';

export type LoopsPrProviderConfig = {
  provider?: LoopsPrProvider;
  apiBaseUrl?: string;
  repository?: string;
  token?: string;
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
};

// R5 · gstack/0 — PR Comment types
export type LoopsCreatePrCommentInput = {
  prId: string;
  body: string;
};

export type LoopsCreatePrCommentResult =
  | { created: true; id: string; url: string }
  | { created: false; reason: string };

@Injectable()
export class LoopsPrProviderClient {
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
    if (!provider || !repository || !this.config.apiBaseUrl || !this.config.token) {
      return { opened: false, reason: 'provider config incomplete', provider };
    }

    if (!this.isAllowedRepository(repository)) {
      return { opened: false, reason: 'repository not allowlisted', provider };
    }

    const data = await this.postJson(
      this.endpoint(provider, repository),
      this.payload(provider, input),
      this.headers(provider, this.config.token),
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
    payload: Record<string, string>,
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
    if (!this.config.token) return 'LOOPS_PR_TOKEN not configured';
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
    const token = this.config.token!;
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

    const headers = this.headers(provider, token);
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
    const token = this.config.token!;
    const baseUrl = this.config.apiBaseUrl!.replace(/\/+$/, '');
    const encodedRepo = encodeURIComponent(repository);

    let url: string;
    if (provider === 'gitlab') {
      url = `${baseUrl}/projects/${encodedRepo}/merge_requests/notes/${commentId}`;
    } else {
      // GitHub and Gitea use issues comments endpoint
      url = `${baseUrl}/repos/${repository}/issues/comments/${commentId}`;
    }

    const headers = this.headers(provider, token);
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

  private async patchJson(
    url: string,
    payload: Record<string, string>,
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
    payload: Record<string, string>,
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
  return {
    provider: parseProvider(env.LOOPS_PR_PROVIDER),
    apiBaseUrl: env.LOOPS_PR_API_BASE_URL,
    repository: env.LOOPS_PR_REPOSITORY,
    token: env.LOOPS_PR_TOKEN,
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
