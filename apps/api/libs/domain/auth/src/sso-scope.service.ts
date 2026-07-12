import { Injectable } from '@nestjs/common';
import { apiError } from '@dofe/infra-common';
import { CommonErrorCode } from '@repo/contracts/errors';
import { SsoClientService } from '@dofe/sso-nestjs';

export type VerifiedTenantScope = {
  tenantId: string;
  tenantName: string;
};

type SsoTenant = {
  tenantId: string;
  tenantName: string;
  tenantDisplayName?: string | null;
};

type SsoTenantPreference = {
  userId: string;
  lastTenantId: string | null;
  tenantOrder?: string[];
  updatedAt: string | Date;
};

@Injectable()
export class SsoScopeService {
  constructor(private readonly ssoClient: SsoClientService) {}

  /**
   * Resolve the verified current tenant for an authenticated subject.
   *
   * SSO is the single source of truth: the SSO-maintained tenant preference
   * (`getTenantPreference(userId).lastTenantId`) is the authoritative current
   * tenant. The client-supplied candidate (header `x-current-tenant`) is only a
   * fallback when SSO has recorded no preference yet. Membership is ALWAYS
   * verified via `getTenants`, and the display name comes from SSO — never from
   * the request. See docs/0712/tenant-team-sso-unique-source/SSO-CONTRACT-AUDIT.md.
   */
  async resolve(input: { ssoSubject: string; tenantId?: string }): Promise<VerifiedTenantScope> {
    const [tenantsResult, preferenceResult] = await Promise.allSettled([
      this.ssoClient.client.users.getTenants(input.ssoSubject) as Promise<SsoTenant[]>,
      this.ssoClient.client.users.getTenantPreference(
        input.ssoSubject,
      ) as Promise<SsoTenantPreference>,
    ]);

    if (tenantsResult.status !== 'fulfilled') {
      throw tenantsResult.reason;
    }
    const tenants = tenantsResult.value;
    const preference = preferenceResult.status === 'fulfilled' ? preferenceResult.value : undefined;

    const preferredTenantId = preference?.lastTenantId?.trim() || undefined;
    const candidateTenantId = input.tenantId?.trim() || undefined;
    const resolvedTenantId = preferredTenantId ?? candidateTenantId;

    if (!resolvedTenantId) {
      throw apiError(CommonErrorCode.UnAuthorized, 'SSO tenant scope is required');
    }

    const tenant = tenants.find((item) => item.tenantId === resolvedTenantId);
    if (!tenant) {
      throw apiError(CommonErrorCode.UnAuthorized, 'SSO tenant scope is not granted');
    }

    return {
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantDisplayName?.trim() || tenant.tenantName,
    };
  }
}
