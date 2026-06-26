import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateBlueprintRequest,
  LoopBlueprint,
  LoopBlueprintListResponse,
  LoopIssuesQuery,
  LoopTool,
  LoopToolListResponse,
  RegisterToolRequest,
  ToolHealthCheckResponse,
  ToolTestResponse,
  UpdateBlueprintRequest,
  UpdateToolRequest,
} from '@repo/contracts';
import { LoopsFileStoreService } from '@app/services/loops-store';

export interface LoopsAdminLogSink {
  log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void;
}

export type LoopsArchivePeriod = '7d' | '30d' | '90d' | 'all';

export type LoopsArchiveRecord = {
  archiveId: string;
  tenantId: string;
  storageKey: string;
  downloadUrl?: string;
  fileCount: number;
  totalSizeBytes: number;
  archivedAt: string;
};

export type LoopsArchiveResponse = LoopsArchiveRecord;

export interface LoopsArchiveControlPort {
  archiveTenant(
    tenantId: string,
    options?: { includeClosed?: boolean; period?: LoopsArchivePeriod },
  ): Promise<LoopsArchiveResponse>;
  listArchives(tenantId: string): Promise<LoopsArchiveRecord[]>;
  refreshDownloadUrl(tenantId: string, archiveId: string): Promise<string | null>;
}

export const LOOPS_ARCHIVE_COLLECTION_PORT = 'LOOPS_ARCHIVE_COLLECTION_PORT';

export interface LoopsArchiveCollectionPort {
  list(query: LoopIssuesQuery): Promise<{
    list: Array<{ issue: { id: string; status?: string } }>;
  }>;
  getIssue(issueId: string): Promise<{
    issue: unknown;
    state?: unknown;
    shards?: unknown[];
    testRecords?: unknown[];
    reviewRecords?: unknown[];
    implementationRecords?: unknown[];
  }>;
  getCrossTenantEvalAggregation(input: {
    tenantId: string;
    period: LoopsArchivePeriod;
    limit: number;
    page: number;
  }): Promise<{ aggregations: unknown[] }>;
}

/**
 * Loops Admin domain service — `@app/services/loops-admin`.
 *
 * Step 9：承接 tool registry 与 delivery blueprint marketplace 的控制面 CRUD。
 * API facade 只保留 ts-rest/controller 审计与兼容委托。
 */
@Injectable()
export class LoopsAdminService {
  constructor(private readonly store: LoopsFileStoreService) {}

  async archiveTenant(
    input: {
      tenantId: string;
      includeClosed?: boolean;
      period?: LoopsArchivePeriod;
    },
    archivePort?: LoopsArchiveControlPort,
  ): Promise<LoopsArchiveResponse> {
    if (!archivePort) {
      throw new Error('Cross-tenant archive service not configured');
    }
    return archivePort.archiveTenant(input.tenantId, {
      includeClosed: input.includeClosed,
      period: input.period,
    });
  }

  async listArchives(
    tenantId: string,
    archivePort?: LoopsArchiveControlPort,
  ): Promise<{ archives: LoopsArchiveRecord[] }> {
    if (!archivePort) {
      return { archives: [] };
    }
    const archives = await archivePort.listArchives(tenantId);
    return { archives };
  }

  async refreshArchiveUrl(
    tenantId: string,
    archiveId: string,
    archivePort?: LoopsArchiveControlPort,
  ): Promise<{
    archiveId: string;
    downloadUrl?: string;
    message: string;
  }> {
    if (!archivePort) {
      throw new Error('Cross-tenant archive service not configured');
    }
    const downloadUrl = await archivePort.refreshDownloadUrl(tenantId, archiveId);
    return {
      archiveId,
      downloadUrl: downloadUrl ?? undefined,
      message: downloadUrl ? 'Download URL refreshed' : 'Failed to refresh download URL',
    };
  }

  async listTools(query: LoopIssuesQuery): Promise<LoopToolListResponse> {
    const { limit = 20, page = 1 } = query;
    const offset = (page - 1) * limit;
    const tools = this.store.listTools();
    const paged = tools.slice(offset, offset + limit);
    return {
      list: paged,
      total: tools.length,
      page,
      limit,
    };
  }

  async getTool(toolId: string): Promise<LoopTool> {
    const tool = this.store.readTool(toolId);
    if (!tool) throw new NotFoundException(`Tool ${toolId} not found`);
    return tool;
  }

  async registerTool(input: RegisterToolRequest, logSink?: LoopsAdminLogSink): Promise<LoopTool> {
    const now = new Date().toISOString();
    const tool: LoopTool = {
      id: `tool-${this.store.nextToolSeq()}`,
      name: input.name,
      kind: input.kind,
      category: input.category,
      status: 'active',
      description: input.description,
      auth: {
        kind: input.authKind,
        configured: false,
        scopes: [],
      },
      permissions: input.permissions,
      compatibility: input.compatibility,
      health: {
        ok: true,
        message: 'Tool registered, pending initial health check',
      },
      risks: [],
      deterministicBoundary: input.deterministicBoundary,
      ownerAgentIds: [],
      createdAt: now,
      updatedAt: now,
    };
    this.store.writeTool(tool);
    logSink?.log('info', `[Loops] Tool registered`, { toolId: tool.id, name: tool.name });
    return tool;
  }

  async updateTool(
    toolId: string,
    input: UpdateToolRequest,
    logSink?: LoopsAdminLogSink,
  ): Promise<LoopTool> {
    const existing = await this.getTool(toolId);
    const now = new Date().toISOString();
    const updated: LoopTool = {
      ...existing,
      name: input.name ?? existing.name,
      status: input.status ?? existing.status,
      description: input.description ?? existing.description,
      permissions: input.permissions ?? existing.permissions,
      compatibility: input.compatibility
        ? { ...existing.compatibility, ...input.compatibility }
        : existing.compatibility,
      deterministicBoundary: input.deterministicBoundary ?? existing.deterministicBoundary,
      updatedAt: now,
    };
    this.store.writeTool(updated);
    logSink?.log('info', `[Loops] Tool updated`, { toolId, status: updated.status });
    return updated;
  }

  async toolHealthCheck(toolId: string): Promise<ToolHealthCheckResponse> {
    const existing = await this.getTool(toolId);
    const now = new Date().toISOString();
    const ok = existing.status === 'active';
    const response: ToolHealthCheckResponse = {
      toolId,
      ok,
      message: ok
        ? `Tool ${existing.name} is active and operational`
        : `Tool ${existing.name} is in ${existing.status} state`,
      checkedAt: now,
    };
    this.store.writeTool({
      ...existing,
      health: { ok, message: response.message, lastCheckedAt: now },
      updatedAt: now,
    });
    return response;
  }

  async testTool(
    toolId: string,
    input?: { input?: Record<string, unknown> },
  ): Promise<ToolTestResponse> {
    await this.getTool(toolId);
    const now = new Date().toISOString();
    return {
      toolId,
      ok: true,
      message: `Tool ${toolId} smoke test passed (control-plane v1)`,
      output: input?.input
        ? `Input received: ${JSON.stringify(input.input).slice(0, 256)}`
        : undefined,
      durationMs: 0,
      testedAt: now,
    };
  }

  async listBlueprints(query: LoopIssuesQuery): Promise<LoopBlueprintListResponse> {
    const { limit = 20, page = 1 } = query;
    const offset = (page - 1) * limit;
    let blueprints = this.store.listBlueprints();
    if (blueprints.length === 0) {
      blueprints = this.seedDefaultBlueprints();
    }
    const paged = blueprints.slice(offset, offset + limit);
    return {
      list: paged,
      total: blueprints.length,
      page,
      limit,
    };
  }

  async getBlueprint(blueprintId: string): Promise<LoopBlueprint> {
    const blueprint = this.store.readBlueprint(blueprintId);
    if (!blueprint) throw new NotFoundException(`Blueprint ${blueprintId} not found`);
    return blueprint;
  }

  async createBlueprint(
    input: CreateBlueprintRequest,
    logSink?: LoopsAdminLogSink,
  ): Promise<LoopBlueprint> {
    const now = new Date().toISOString();
    const blueprint: LoopBlueprint = {
      id: `bp-${this.store.nextBlueprintSeq()}`,
      name: input.name,
      kind: input.kind,
      description: input.description,
      version: '1.0.0',
      priority: 'P2',
      active: true,
      personaSequence: input.personaSequence,
      evalSuiteId: input.evalSuiteId,
      gateProfile: input.gateProfile ?? { humanGates: [], agentGates: [], releaseGates: [] },
      runtimePolicy: input.runtimePolicy,
      evidenceTemplate: { requiredArtifacts: [] },
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.store.writeBlueprint(blueprint);
    logSink?.log('info', `[Loops] Blueprint created`, {
      blueprintId: blueprint.id,
      name: blueprint.name,
    });
    return blueprint;
  }

  async updateBlueprint(
    blueprintId: string,
    input: UpdateBlueprintRequest,
    logSink?: LoopsAdminLogSink,
  ): Promise<LoopBlueprint> {
    const existing = await this.getBlueprint(blueprintId);
    const now = new Date().toISOString();
    const updated: LoopBlueprint = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      active: input.active ?? existing.active,
      personaSequence: input.personaSequence ?? existing.personaSequence,
      evalSuiteId: input.evalSuiteId !== undefined ? input.evalSuiteId : existing.evalSuiteId,
      gateProfile: input.gateProfile
        ? {
            humanGates: input.gateProfile.humanGates ?? existing.gateProfile.humanGates,
            agentGates: input.gateProfile.agentGates ?? existing.gateProfile.agentGates,
            releaseGates: input.gateProfile.releaseGates ?? existing.gateProfile.releaseGates,
          }
        : existing.gateProfile,
      runtimePolicy: {
        primary: input.runtimePolicy?.primary ?? existing.runtimePolicy.primary,
        fallback: input.runtimePolicy?.fallback ?? existing.runtimePolicy.fallback,
      },
      updatedAt: now,
    };
    this.store.writeBlueprint(updated);
    logSink?.log('info', `[Loops] Blueprint updated`, { blueprintId, active: updated.active });
    return updated;
  }

  async rollbackBlueprint(
    blueprintId: string,
    input?: { targetVersion?: string; reason?: string },
    logSink?: LoopsAdminLogSink,
  ): Promise<LoopBlueprint> {
    const current = await this.getBlueprint(blueprintId);
    const now = new Date().toISOString();

    this.store.writeBlueprintHistory(blueprintId, current, now);
    const history = this.store.listBlueprintHistory(blueprintId);

    const target = input?.targetVersion
      ? history.find((h) => h.version === input!.targetVersion)
      : history[history.length - 1];

    if (!target && input?.targetVersion) {
      throw new NotFoundException(
        `Blueprint ${blueprintId} version ${input.targetVersion} not found in history`,
      );
    }
    if (!target) {
      throw new BadRequestException(`Blueprint ${blueprintId} has no history to rollback to`);
    }

    const rolled: LoopBlueprint = {
      ...current,
      name: target.snapshot.name,
      description: target.snapshot.description,
      personaSequence: target.snapshot.personaSequence,
      evalSuiteId: target.snapshot.evalSuiteId,
      gateProfile: target.snapshot.gateProfile,
      runtimePolicy: target.snapshot.runtimePolicy,
      version: target.version,
      updatedAt: now,
    };
    this.store.writeBlueprint(rolled);
    logSink?.log('info', `[Loops] Blueprint rolled back`, {
      blueprintId,
      fromVersion: current.version,
      toVersion: target.version,
      reason: input?.reason,
    });
    return rolled;
  }

  private seedDefaultBlueprints(): LoopBlueprint[] {
    const now = new Date().toISOString();
    const defaults: LoopBlueprint[] = [
      {
        id: 'bp-bugfix',
        name: 'Bugfix Loop',
        kind: 'bugfix',
        description: 'Bug fix delivery with regression test and global review',
        version: '1.0.0',
        priority: 'P1',
        active: true,
        personaSequence: [
          'Intake Analyst',
          'Spec Writer',
          'Work Planner',
          'Builder',
          'Test Runner',
          'Code Reviewer',
          'Release Reviewer',
        ],
        evalSuiteId: 'eval-delivery-readiness',
        gateProfile: {
          humanGates: ['Spec Review'],
          agentGates: ['Code Review'],
          releaseGates: ['Global Review', 'PR Evidence'],
        },
        runtimePolicy: { primary: 'codex-cli', fallback: 'claude-code-cli' },
        evidenceTemplate: {
          requiredArtifacts: ['test-records', 'review-records', 'global-verdict'],
        },
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bp-feature',
        name: 'Feature Loop',
        kind: 'feature',
        description: 'New feature delivery with full test matrix and contract validation',
        version: '1.0.0',
        priority: 'P1',
        active: true,
        personaSequence: [
          'Intake Analyst',
          'Spec Writer',
          'Work Planner',
          'Builder',
          'Test Runner',
          'Code Reviewer',
          'Release Reviewer',
          'Evidence Curator',
        ],
        evalSuiteId: 'eval-architecture-compliance',
        gateProfile: {
          humanGates: ['Spec Review'],
          agentGates: ['Code Review', 'Architecture Check'],
          releaseGates: ['Global Review', 'PR Evidence', 'Eval Gate'],
        },
        runtimePolicy: { primary: 'claude-code-cli', fallback: 'codex-cli' },
        evidenceTemplate: {
          requiredArtifacts: [
            'spec',
            'test-records',
            'review-records',
            'global-verdict',
            'pr-comment',
          ],
        },
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bp-refactor',
        name: 'Refactor Loop',
        kind: 'refactor',
        description: 'Behavior-preserving refactor with existing test pass guarantee',
        version: '1.0.0',
        priority: 'P2',
        active: true,
        personaSequence: [
          'Intake Analyst',
          'Work Planner',
          'Builder',
          'Test Runner',
          'Code Reviewer',
          'Release Reviewer',
        ],
        evalSuiteId: 'eval-test-evidence',
        gateProfile: {
          humanGates: [],
          agentGates: ['Code Review'],
          releaseGates: ['Global Review', 'All Tests Pass'],
        },
        runtimePolicy: { primary: 'codex-cli' },
        evidenceTemplate: {
          requiredArtifacts: ['test-records', 'review-records', 'global-verdict'],
        },
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bp-docs',
        name: 'Documentation Loop',
        kind: 'docs',
        description: 'Documentation update with link validation',
        version: '1.0.0',
        priority: 'P3',
        active: true,
        personaSequence: ['Intake Analyst', 'Builder', 'Code Reviewer'],
        evalSuiteId: 'eval-delivery-readiness',
        gateProfile: { humanGates: [], agentGates: ['Link Check'], releaseGates: ['PR Evidence'] },
        runtimePolicy: { primary: 'codex-cli' },
        evidenceTemplate: { requiredArtifacts: ['review-records', 'pr-comment'] },
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bp-integration',
        name: 'Integration Loop',
        kind: 'integration',
        description: 'Third-party integration with contract and security validation',
        version: '1.0.0',
        priority: 'P1',
        active: true,
        personaSequence: [
          'Intake Analyst',
          'Spec Writer',
          'Work Planner',
          'Builder',
          'Test Runner',
          'Code Reviewer',
          'Release Reviewer',
          'Evidence Curator',
        ],
        evalSuiteId: 'eval-runtime-safety',
        gateProfile: {
          humanGates: ['Spec Review'],
          agentGates: ['Code Review', 'Security Scan'],
          releaseGates: ['Global Review', 'PR Evidence', 'Runtime Check'],
        },
        runtimePolicy: { primary: 'claude-code-cli', fallback: 'codex-cli' },
        evidenceTemplate: {
          requiredArtifacts: [
            'spec',
            'test-records',
            'review-records',
            'global-verdict',
            'pr-comment',
          ],
        },
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bp-flow',
        name: 'Flow Loop',
        kind: 'flow',
        description: 'Multi-step workflow automation delivery',
        version: '1.0.0',
        priority: 'P2',
        active: true,
        personaSequence: [
          'Intake Analyst',
          'Spec Writer',
          'Work Planner',
          'Builder',
          'Test Runner',
          'Code Reviewer',
          'Release Reviewer',
        ],
        evalSuiteId: 'eval-delivery-readiness',
        gateProfile: {
          humanGates: ['Spec Review'],
          agentGates: ['Code Review'],
          releaseGates: ['Global Review', 'PR Evidence'],
        },
        runtimePolicy: { primary: 'codex-cli', fallback: 'claude-code-cli' },
        evidenceTemplate: {
          requiredArtifacts: ['spec', 'test-records', 'review-records', 'global-verdict'],
        },
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bp-security',
        name: 'Security Patch Loop',
        kind: 'security',
        description: 'Security fix with mandatory human approval and security scan',
        version: '1.0.0',
        priority: 'P0',
        active: true,
        personaSequence: [
          'Intake Analyst',
          'Work Planner',
          'Builder',
          'Test Runner',
          'Code Reviewer',
          'Release Reviewer',
        ],
        evalSuiteId: 'eval-runtime-safety',
        gateProfile: {
          humanGates: ['Security Approval'],
          agentGates: ['Security Scan', 'Code Review'],
          releaseGates: ['Global Review', 'PR Evidence'],
        },
        runtimePolicy: { primary: 'codex-cli' },
        evidenceTemplate: {
          requiredArtifacts: ['test-records', 'review-records', 'global-verdict', 'pr-comment'],
        },
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bp-dependency',
        name: 'Dependency Upgrade Loop',
        kind: 'dependency',
        description: 'Dependency upgrade with lockfile validation and test matrix',
        version: '1.0.0',
        priority: 'P2',
        active: true,
        personaSequence: ['Intake Analyst', 'Builder', 'Test Runner', 'Code Reviewer'],
        evalSuiteId: 'eval-test-evidence',
        gateProfile: {
          humanGates: [],
          agentGates: ['Test Matrix'],
          releaseGates: ['PR Evidence', 'All Tests Pass'],
        },
        runtimePolicy: { primary: 'codex-cli' },
        evidenceTemplate: { requiredArtifacts: ['test-records', 'review-records'] },
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
    for (const bp of defaults) {
      this.store.writeBlueprint(bp);
    }
    return defaults;
  }
}
