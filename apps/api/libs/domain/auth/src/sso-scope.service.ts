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

@Injectable()
export class SsoScopeService {
  constructor(private readonly ssoClient: SsoClientService) {}

  async resolve(input: { ssoSubject: string; tenantId?: string }): Promise<VerifiedTenantScope> {
    const tenantId = input.tenantId?.trim();
    if (!tenantId) {
      throw apiError(CommonErrorCode.UnAuthorized, 'SSO tenant scope is required');
    }

    const tenants = (await this.ssoClient.client.users.getTenants(input.ssoSubject)) as SsoTenant[];
    const tenant = tenants.find((item) => item.tenantId === tenantId);
    if (!tenant) {
      throw apiError(CommonErrorCode.UnAuthorized, 'SSO tenant scope is not granted');
    }

    return {
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantDisplayName?.trim() || tenant.tenantName,
    };
  }
}
