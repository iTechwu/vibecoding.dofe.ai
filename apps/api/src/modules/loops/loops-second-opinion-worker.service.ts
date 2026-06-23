import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { z } from 'zod';
import type {
  LoopDetail,
  LoopRuntimeMode,
  LoopSecondOpinion,
  LoopSecondOpinionReviewer,
} from '@repo/contracts';
import { extractJson, runProcess } from './adapters/loops-process.util';
import { resolveAllowedTargetRepo } from './loops-path-policy.util';
import { readLoopsRuntimeConfig } from './loops-runtime-config.util';
import { LoopsWorkspaceProfileService } from './loops-workspace-profile.service';
import { planAgentInvocation } from './loops-runtime-command-builder.util';
import {
  buildPrimarySecondOpinionFindings,
  buildSecondarySecondOpinionFindings,
  compareSecondOpinionFindings,
} from './loops-second-opinion-comparison.util';

const SecondOpinionCliOutputSchema = z.object({
  status: z.enum(['passed', 'needs_changes']).default('passed'),
  summary: z.string().trim().min(1),
  findings: z
    .array(
      z.object({
        severity: z.enum(['minor', 'major', 'critical']).default('major'),
        desc: z.string().trim().min(1),
        fingerprint: z.string().trim().min(1).optional(),
      }),
    )
    .default([]),
});

@Injectable()
export class LoopsSecondOpinionWorkerService {
  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
    @Optional()
    private readonly workspaceProfile?: LoopsWorkspaceProfileService,
  ) {}

  async run(input: {
    detail: LoopDetail;
    primary: LoopSecondOpinionReviewer;
    createdAt?: string;
  }): Promise<LoopSecondOpinion> {
    const updated = input.createdAt ?? new Date().toISOString();
    const prompt = this.renderPrompt(input.detail);
    const safeCwd = await resolveAllowedTargetRepo(input.detail.issue.targetRepo);
    const runtime = await this.resolveRuntime();
    const invocation = planAgentInvocation({
      mode: runtime.mode,
      agent: 'claude-code',
      hostWorkspaceRoot: safeCwd,
      containerWorkdir: runtime.containerWorkdir,
      buildAgentArgs: (workdir) => [
        '-p',
        prompt,
        '--output-format',
        'json',
        '--add-dir',
        workdir,
        '--permission-mode',
        'readOnly',
      ],
    });
    const result = await runProcess({
      command: invocation.command,
      args: invocation.args,
      cwd: invocation.cwd,
      timeoutMs: await this.timeoutMs(),
    });

    if (result.exitCode !== 0) {
      const summary = `Claude Code secondary review did not run successfully (exit=${result.exitCode}).`;
      this.logger?.warn('[Loops] Second opinion worker failed', {
        issueId: input.detail.issue.id,
        exitCode: result.exitCode,
      });
      return this.pendingReport(input, summary, updated);
    }

    const parsed = SecondOpinionCliOutputSchema.safeParse(extractJson(result.stdout));
    if (!parsed.success) {
      const summary = 'Claude Code secondary review returned output that did not match schema.';
      this.logger?.warn('[Loops] Second opinion worker returned invalid schema', {
        issueId: input.detail.issue.id,
      });
      return this.pendingReport(input, summary, updated);
    }

    const output = parsed.data;
    const primaryFindings = buildPrimarySecondOpinionFindings({
      reviewRecords: input.detail.reviewRecords,
      globalReview: input.detail.globalReview,
    });
    const secondaryFindings = buildSecondarySecondOpinionFindings(output.findings);
    const comparison = compareSecondOpinionFindings({
      primary: primaryFindings,
      secondary: secondaryFindings,
    });
    const primary: LoopSecondOpinionReviewer = {
      ...input.primary,
      findingsCount: primaryFindings.length,
      findings: primaryFindings,
    };
    const secondary: LoopSecondOpinionReviewer = {
      role: 'secondary',
      reviewer: 'claude-code',
      status: output.status,
      findingsCount: secondaryFindings.length,
      findings: secondaryFindings,
      evidenceIds: [`${input.detail.issue.id}-second-opinion`],
      summary: output.summary,
    };
    return {
      id: `${input.detail.issue.id}-second-opinion`,
      status:
        comparison.conflictCount > 0
          ? 'conflict'
          : primary.status === 'passed' && output.status === 'passed'
            ? 'passed'
            : primary.status === 'needs_changes' || output.status === 'needs_changes'
              ? 'needs_changes'
              : 'pending',
      primary,
      secondary,
      comparison,
      requiredForRelease: false,
      updated,
    };
  }

  private pendingReport(
    input: { detail: LoopDetail; primary: LoopSecondOpinionReviewer },
    summary: string,
    updated: string,
  ): LoopSecondOpinion {
    return {
      id: `${input.detail.issue.id}-second-opinion`,
      status: 'pending',
      primary: input.primary,
      secondary: {
        role: 'secondary',
        reviewer: 'claude-code',
        status: 'not_run',
        findingsCount: 0,
        findings: [],
        evidenceIds: [],
        summary,
      },
      comparison: {
        agreementCount: 0,
        primaryOnlyCount: input.primary.findingsCount,
        secondaryOnlyCount: 0,
        conflictCount: 0,
        agreementFingerprints: [],
        primaryOnlyFingerprints: input.primary.findings.map((finding) => finding.fingerprint),
        secondaryOnlyFingerprints: [],
        conflictFingerprints: [],
      },
      requiredForRelease: false,
      updated,
    };
  }

  private async timeoutMs(): Promise<number> {
    const config = await readLoopsRuntimeConfig();
    return config.shardTimeoutSec * 1000;
  }

  private async resolveRuntime(): Promise<{ mode: LoopRuntimeMode; containerWorkdir: string }> {
    if (!this.workspaceProfile) {
      return { mode: 'local-cli', containerWorkdir: '/workspace' };
    }
    try {
      const workspace = await this.workspaceProfile.resolve();
      return {
        mode: workspace.agents['claude-code'].mode,
        containerWorkdir: workspace.containerWorkdir ?? '/workspace',
      };
    } catch {
      return { mode: 'local-cli', containerWorkdir: '/workspace' };
    }
  }

  private renderPrompt(detail: LoopDetail): string {
    const evidence = [
      ...detail.implementationRecords.map((record) => `implementation:${record.summary}`),
      ...detail.testRecords.map((record) => `test:${record.status}:${record.commands.length}`),
      ...detail.reviewRecords.map((record) => `review:${record.verdict}:${record.summary}`),
      detail.globalReview
        ? `global:${detail.globalReview.verdict}:${detail.globalReview.summary}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    return [
      '你是 Loops 的 Claude Code secondary reviewer。只做独立审查，不修改文件。',
      `Issue: ${detail.issue.id} ${detail.issue.title}`,
      `Body: ${detail.issue.body}`,
      'Acceptance Criteria:',
      ...detail.issue.acceptanceCriteria.map((item) => `- ${item}`),
      'Evidence:',
      evidence || 'No implementation evidence yet.',
      '请严格输出 JSON：{"status":"passed"|"needs_changes","summary":string,"findings":[{"severity":"minor"|"major"|"critical","desc":string,"fingerprint":string}]}',
    ].join('\n');
  }
}
