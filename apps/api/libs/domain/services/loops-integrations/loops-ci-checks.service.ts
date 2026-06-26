import { Injectable, NotFoundException } from '@nestjs/common';
import type { LoopCiCheckAction, LoopCiCheckIntegration } from '@repo/contracts';

/**
 * Port supplying CI publication evidence from loop detail. `buildDeliveryEvidence`
 * + `readDetail` still live in the API facade (delivery evidence builder has not
 * moved to `loops-evidence` yet), so the integrations service consumes a narrow
 * port instead of the facade directly.
 */
export interface LoopsCiDeliveryEvidencePort {
  buildPublicationEvidence(input: {
    issueId?: string;
    prId?: string;
    detailsUrl?: string;
    evidenceBacklink?: string;
  }): Promise<{
    issueId?: string;
    prId?: string;
    detailsUrl?: string;
    evidenceBacklink?: string;
    workPackageCommitMap: Array<{
      workPackageId: string;
      title?: string;
      commitSha?: string;
      commitMessage?: string;
      branch?: string;
      files: string[];
    }>;
  }>;
}

/**
 * Loops CI Checks domain service — `@app/services/loops-integrations`.
 *
 * Step 7 / nextstep Step N6：CI checks registry（hardcoded integration catalog）
 * + status/item helpers + publication evidence builder 已从 legacy facade 下沉。
 * 实际的 GitHub Checks provider publish、permission check、publication persistence
 * 仍属 API facade；本 service 只承接可复用的纯 registry 与 evidence 组装。
 */
@Injectable()
export class LoopsCiChecksService {
  /** Static CI check integration catalog. */
  listCiCheckItems(): LoopCiCheckIntegration[] {
    return [
      {
        id: 'github-delivery-evidence',
        provider: 'github-checks',
        name: 'GitHub Delivery Evidence Check',
        status: 'configured',
        requiredForRelease: true,
        checkSuites: ['delivery-readiness', 'runtime-safety', 'test-evidence'],
        targetRef: 'convergence-pr',
        health: {
          ok: true,
          message: 'Ready to publish derived delivery evidence when provider client is enabled.',
        },
        risks: ['GitHub Checks API token and repo installation are required for publish.'],
      },
      {
        id: 'generic-ci-regression',
        provider: 'generic-ci',
        name: 'Generic Regression CI',
        status: 'configured',
        requiredForRelease: false,
        checkSuites: ['test-evidence'],
        targetRef: 'loop-artifacts',
        health: {
          ok: true,
          message: 'Can mirror Loops test records into an external CI dashboard.',
        },
        risks: [],
      },
    ];
  }

  getCiCheckItem(id: string): LoopCiCheckIntegration {
    const found = this.listCiCheckItems().find((item) => item.id === id);
    if (!found) throw new NotFoundException(`CI check integration ${id} not found`);
    return found;
  }

  withCiCheckStatus(
    id: string,
    status: LoopCiCheckIntegration['status'],
    message: string,
  ): LoopCiCheckIntegration {
    return {
      ...this.getCiCheckItem(id),
      status,
      lastPublishedAt: new Date().toISOString(),
      health: {
        ok: status !== 'failed',
        message,
      },
    };
  }

  /**
   * Build the publication-evidence payload (work-package → commit map) for a CI
   * check publish action. When `issueId` is absent the result is a minimal
   * backlink-only record; otherwise delivery evidence is assembled via the port
   * so this service stays decoupled from `LoopsFileStoreService` / facade.
   */
  async buildCiCheckPublicationEvidence(
    action: LoopCiCheckAction,
    evidencePort?: LoopsCiDeliveryEvidencePort,
  ): Promise<{
    issueId?: string;
    prId?: string;
    detailsUrl?: string;
    evidenceBacklink?: string;
    workPackageCommitMap: Array<{
      workPackageId: string;
      title?: string;
      commitSha?: string;
      commitMessage?: string;
      branch?: string;
      files: string[];
    }>;
  }> {
    const evidenceBacklink = action.evidenceBacklink ?? action.detailsUrl;
    if (!action.issueId || !evidencePort) {
      return {
        prId: action.prId,
        detailsUrl: action.detailsUrl ?? evidenceBacklink,
        evidenceBacklink,
        workPackageCommitMap: [],
      };
    }

    return evidencePort.buildPublicationEvidence({
      issueId: action.issueId,
      prId: action.prId,
      detailsUrl: action.detailsUrl,
      evidenceBacklink,
    });
  }
}
