import { Injectable } from '@nestjs/common';
import { SsoScopeService } from '@app/auth/sso-scope.service';
import { LoopsPersistenceService } from '@app/services/loops-store';

type MappedBackfillItem = {
  issueId: string;
  tenantId: string;
};

type PendingBackfillItem = {
  issueId: string;
  reason: 'non-sso-submitter' | 'unverified-sso-scope' | 'concurrent-scope-assignment';
};

/**
 * Controlled migration for the additive LoopIssue tenant column. SSO remains
 * the authority: a row is updated only when its SSO submitter has a preferred
 * tenant that also passes the SSO membership check in SsoScopeService.
 */
@Injectable()
export class LoopsScopeBackfillService {
  constructor(
    private readonly persistence: LoopsPersistenceService,
    private readonly ssoScope: SsoScopeService,
  ) {}

  async run(input: { dryRun?: boolean; limit?: number } = {}) {
    const dryRun = input.dryRun ?? true;
    const candidates = await this.persistence.listUnscopedIssues(input.limit ?? 100);
    const mapped: MappedBackfillItem[] = [];
    const pending: PendingBackfillItem[] = [];

    for (const issue of candidates) {
      if (issue.submitterProvider !== 'dofe-sso') {
        pending.push({ issueId: issue.id, reason: 'non-sso-submitter' });
        continue;
      }

      try {
        // No client candidate is supplied: only SSO's stored preference can
        // select a historical tenant, and resolve() verifies membership.
        const scope = await this.ssoScope.resolve({ ssoSubject: issue.submitterId });
        if (
          !dryRun &&
          !(await this.persistence.assignTenantIdIfUnscoped(issue.id, scope.tenantId))
        ) {
          pending.push({ issueId: issue.id, reason: 'concurrent-scope-assignment' });
          continue;
        }
        mapped.push({ issueId: issue.id, tenantId: scope.tenantId });
      } catch {
        pending.push({ issueId: issue.id, reason: 'unverified-sso-scope' });
      }
    }

    return {
      dryRun,
      examined: candidates.length,
      mapped,
      pending,
      updated: dryRun ? 0 : mapped.length,
    };
  }
}
