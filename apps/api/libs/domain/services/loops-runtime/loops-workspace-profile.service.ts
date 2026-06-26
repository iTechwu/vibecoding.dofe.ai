import { Inject, Injectable, Optional } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  LoopWorkspaceAgentProfile,
  LoopWorkspaceProfile,
  LoopWorkspaceRule,
  LoopWorkspaceRuleDiagnostic,
  LoopWorkspaceRulesSummary,
  LoopWorkspaceStatus,
  LoopWorkspaceSummary,
  LoopWorkspacesResponse,
  LoopAgentKind,
  LoopRuntimeMode,
  PullLoopImageResponse,
  UpsertLoopWorkspaceRequest,
} from '@repo/contracts';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { LoopsDockerClient } from './loops-docker.client';
import { LOOPS_RUNTIME_IMAGES, LOOPS_RUNTIME_LOCAL_COMMAND } from './loops-runtime-images';
import { resolveLoopsRuntimeProfilePath, findLoopsWorkspaceRoot } from '@app/services/loops-store';

const DEFAULT_WORKSPACE_ID = 'default';
const DEFAULT_CONTAINER_WORKDIR = '/workspace';
const WORKSPACE_RULE_CANDIDATES: Array<{ id: string; label: string; path: string }> = [
  { id: 'agents', label: 'AGENTS.md', path: 'AGENTS.md' },
  { id: 'claude', label: 'CLAUDE.md', path: 'CLAUDE.md' },
  { id: 'cursor-rules', label: 'Cursor rules', path: '.cursor/rules' },
  { id: 'cline-rules', label: 'Cline rules', path: '.clinerules' },
];

interface PersistedAgentProfile {
  mode: LoopRuntimeMode;
  localCommand?: string;
  dockerImage?: string;
}

interface PersistedWorkspace {
  workspaceId: string;
  root: string;
  containerWorkdir?: string;
  agents?: {
    codex?: Partial<PersistedAgentProfile>;
    'claude-code'?: Partial<PersistedAgentProfile>;
  };
}

interface PersistedProfile {
  current?: string;
  workspaces?: PersistedWorkspace[];
}

const AGENT_KEYS: LoopAgentKind[] = ['codex', 'claude-code'];

/**
 * File-backed workspace runtime profile (0622 · B2).
 *
 * `.loops/runtime/profile.json` holds the list of workspaces and the active one.
 * Docker runtime must bind a workspace so the container mount, workdir, config
 * and cache dirs are explicit and isolated per workspace. No DB involvement
 * (Rule 1); the profile is pure local state, validated by existence + writability.
 */
@Injectable()
export class LoopsWorkspaceProfileService {
  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
    @Optional()
    private readonly docker: LoopsDockerClient = new LoopsDockerClient(),
  ) {}

  async list(): Promise<LoopWorkspacesResponse> {
    const profile = await this.readWithDefault();
    const summaries = await Promise.all(
      profile.workspaces.map(async (ws) => this.toSummary(ws, profile.current)),
    );
    const current = this.resolveCurrent(profile);
    return { workspaces: summaries, current };
  }

  async get(workspaceId: string): Promise<LoopWorkspaceProfile | undefined> {
    const profile = await this.readWithDefault();
    const ws = profile.workspaces.find((item) => item.workspaceId === workspaceId);
    if (!ws) return undefined;
    return this.toProfile(ws);
  }

  /** Resolve a workspace by id, falling back to the current/default workspace. */
  async resolve(workspaceId?: string): Promise<LoopWorkspaceProfile> {
    const profile = await this.readWithDefault();
    const current = this.resolveCurrent(profile);
    const id = workspaceId && workspaceId.length > 0 ? workspaceId : current;
    const ws =
      profile.workspaces.find((item) => item.workspaceId === id) ??
      profile.workspaces.find((item) => item.workspaceId === current) ??
      profile.workspaces[0];
    return this.toProfile(ws);
  }

  async upsert(input: UpsertLoopWorkspaceRequest): Promise<LoopWorkspacesResponse> {
    const profile = await this.readWithDefault();
    const normalizedRoot = path.resolve(input.root);
    const existingIdx = profile.workspaces.findIndex((ws) => ws.workspaceId === input.workspaceId);
    const base: PersistedWorkspace =
      existingIdx >= 0
        ? { ...profile.workspaces[existingIdx] }
        : { workspaceId: input.workspaceId, root: normalizedRoot };
    base.root = normalizedRoot;
    if (input.containerWorkdir) base.containerWorkdir = input.containerWorkdir;
    base.agents = {
      codex: this.mergeAgent(base.agents?.codex, input.agents?.codex?.mode, 'codex'),
      'claude-code': this.mergeAgent(
        base.agents?.['claude-code'],
        input.agents?.['claude-code']?.mode,
        'claude-code',
      ),
    };

    if (existingIdx >= 0) {
      profile.workspaces[existingIdx] = base;
    } else {
      profile.workspaces.push(base);
    }

    if (input.makeDefault) {
      profile.current = base.workspaceId;
    } else if (!profile.current) {
      profile.current = base.workspaceId;
    }

    await this.write(profile);
    return this.list();
  }

  async setCurrent(workspaceId: string): Promise<LoopWorkspacesResponse> {
    const profile = await this.readWithDefault();
    if (!profile.workspaces.some((ws) => ws.workspaceId === workspaceId)) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    profile.current = workspaceId;
    await this.write(profile);
    return this.list();
  }

  /** Validate a workspace root: exists, is a directory, and is writable. */
  async validate(root: string): Promise<LoopWorkspaceStatus> {
    try {
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) return 'ERROR';
      await fs.access(root, fs.constants.W_OK);
      return 'VALIDATED';
    } catch {
      return 'ERROR';
    }
  }

  async scanRules(root: string): Promise<LoopWorkspaceRulesSummary> {
    const rules = await Promise.all(
      WORKSPACE_RULE_CANDIDATES.map((candidate) => this.scanRule(root, candidate)),
    );
    return {
      present: rules.filter((rule) => rule.status === 'present').length,
      total: rules.length,
      rules,
      diagnostics: this.buildRuleDiagnostics(rules),
    };
  }

  /**
   * Pull the Docker fallback image for an agent in a workspace (0622 · B6).
   *
   * Runs `docker pull <image>`. The image tag is resolved from the workspace
   * profile (defaulting to the fixed registry image). Best-effort: a down
   * daemon or a missing `docker` binary returns `failed` with a message rather
   * than throwing, so the UI can surface an actionable diagnostic.
   */
  async pullImage(workspaceId: string, agent: LoopAgentKind): Promise<PullLoopImageResponse> {
    const workspace = await this.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    const image = workspace.agents[agent].dockerImage;
    const outcome = await this.docker.pull(image);
    return {
      agent,
      image,
      status: outcome.ok ? 'pulled' : 'failed',
      message: outcome.message,
    };
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private resolveCurrent(profile: PersistedProfile): string {
    const workspaces = profile.workspaces ?? [];
    if (profile.current && workspaces.some((ws) => ws.workspaceId === profile.current)) {
      return profile.current;
    }
    return workspaces[0]?.workspaceId ?? DEFAULT_WORKSPACE_ID;
  }

  private async readWithDefault(): Promise<
    Required<Pick<PersistedProfile, 'workspaces'>> & PersistedProfile
  > {
    const raw = await this.read();
    const workspaces = raw.workspaces?.length ? raw.workspaces : [this.defaultWorkspace()];
    return { current: raw.current, workspaces };
  }

  private async read(): Promise<PersistedProfile> {
    try {
      const content = await fs.readFile(resolveLoopsRuntimeProfilePath(), 'utf8');
      const parsed = JSON.parse(content) as PersistedProfile;
      return parsed && Array.isArray(parsed.workspaces) ? parsed : {};
    } catch (error) {
      this.logger?.debug?.('Loops workspace profile not readable; using default.', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  private async write(profile: PersistedProfile): Promise<void> {
    const filePath = resolveLoopsRuntimeProfilePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf8');
  }

  private defaultWorkspace(): PersistedWorkspace {
    return {
      workspaceId: DEFAULT_WORKSPACE_ID,
      root: findLoopsWorkspaceRoot(),
      containerWorkdir: DEFAULT_CONTAINER_WORKDIR,
      agents: {
        codex: { mode: 'local-cli' },
        'claude-code': { mode: 'local-cli' },
      },
    };
  }

  private mergeAgent(
    existing: Partial<PersistedAgentProfile> | undefined,
    mode: LoopRuntimeMode | undefined,
    agent: LoopAgentKind,
  ): PersistedAgentProfile {
    return {
      mode: mode ?? existing?.mode ?? 'local-cli',
      localCommand: existing?.localCommand ?? LOOPS_RUNTIME_LOCAL_COMMAND[agent],
      dockerImage: existing?.dockerImage ?? LOOPS_RUNTIME_IMAGES[agent],
    };
  }

  private async toSummary(
    ws: PersistedWorkspace,
    currentId: string | undefined,
  ): Promise<LoopWorkspaceSummary> {
    const status = await this.validate(ws.root);
    const agents = this.toAgentMap(ws);
    const current = this.resolveCurrentSafe(currentId);
    const rules = await this.scanRules(ws.root);
    return {
      workspaceId: ws.workspaceId,
      root: ws.root,
      status,
      isDefault: ws.workspaceId === current,
      selected: {
        codex: agents.codex.mode,
        'claude-code': agents['claude-code'].mode,
      },
      rules,
    };
  }

  private resolveCurrentSafe(currentId: string | undefined): string {
    return currentId && currentId.length > 0 ? currentId : DEFAULT_WORKSPACE_ID;
  }

  private async toProfile(ws: PersistedWorkspace): Promise<LoopWorkspaceProfile> {
    const status = await this.validate(ws.root);
    return {
      workspaceId: ws.workspaceId,
      root: ws.root,
      containerWorkdir: ws.containerWorkdir ?? DEFAULT_CONTAINER_WORKDIR,
      status,
      isDefault: ws.workspaceId === DEFAULT_WORKSPACE_ID,
      agents: this.toAgentMap(ws),
      rules: await this.scanRules(ws.root),
    };
  }

  private async scanRule(
    root: string,
    candidate: { id: string; label: string; path: string },
  ): Promise<LoopWorkspaceRule> {
    const absolutePath = path.join(root, candidate.path);
    try {
      const stat = await fs.stat(absolutePath);
      if (stat.isDirectory()) {
        const entries = await fs.readdir(absolutePath);
        return {
          ...candidate,
          status: entries.length > 0 ? 'present' : 'missing',
          summary: entries.length > 0 ? `${entries.length} rule files` : undefined,
          updated: entries.length > 0 ? stat.mtime.toISOString() : undefined,
        };
      }

      const content = await fs.readFile(absolutePath, 'utf8');
      const firstMeaningfulLine =
        content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line.length > 0 && !line.startsWith('<!--')) ?? candidate.label;
      return {
        ...candidate,
        status: 'present',
        summary: firstMeaningfulLine.slice(0, 140),
        updated: stat.mtime.toISOString(),
      };
    } catch {
      return {
        ...candidate,
        status: 'missing',
      };
    }
  }

  private buildRuleDiagnostics(rules: LoopWorkspaceRule[]): LoopWorkspaceRuleDiagnostic[] {
    const present = rules.filter((rule) => rule.status === 'present');
    const missing = rules.filter((rule) => rule.status === 'missing');
    const diagnostics: LoopWorkspaceRuleDiagnostic[] = [];

    if (present.length === 0) {
      diagnostics.push({
        id: 'rules-missing',
        level: 'warning',
        message: 'No workspace rule files were found.',
        evidence: rules.map((rule) => rule.path).join(', '),
      });
    } else if (present.length === 1) {
      diagnostics.push({
        id: 'rules-thin',
        level: 'info',
        message: 'Only one workspace rule source is present.',
        evidence: present[0]?.path ?? 'workspace rules',
      });
    }

    const agentReadable = present.filter((rule) =>
      ['agents', 'claude', 'cline-rules'].includes(rule.id),
    );
    if (agentReadable.length > 1) {
      diagnostics.push({
        id: 'rules-overlap',
        level: 'warning',
        message: 'Multiple agent-readable rule sources are present; verify precedence.',
        evidence: agentReadable.map((rule) => rule.path).join(', '),
      });
    }

    for (const rule of missing) {
      if (rule.id === 'cursor-rules' || rule.id === 'cline-rules') {
        diagnostics.push({
          id: `missing-${rule.id}`,
          level: 'info',
          message: `${rule.label} are not present.`,
          evidence: rule.path,
        });
      }
    }

    return diagnostics;
  }

  private toAgentMap(ws: PersistedWorkspace): Record<LoopAgentKind, LoopWorkspaceAgentProfile> {
    const result = {} as Record<LoopAgentKind, LoopWorkspaceAgentProfile>;
    for (const agent of AGENT_KEYS) {
      const partial = ws.agents?.[agent];
      result[agent] = {
        mode: partial?.mode ?? 'local-cli',
        localCommand: partial?.localCommand ?? LOOPS_RUNTIME_LOCAL_COMMAND[agent],
        dockerImage: partial?.dockerImage ?? LOOPS_RUNTIME_IMAGES[agent],
      };
    }
    return result;
  }
}
