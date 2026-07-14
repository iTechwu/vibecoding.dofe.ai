import { Injectable } from '@nestjs/common';

export type VerifiedTenantScope = {
  tenantId: string;
  tenantName: string;
};

@Injectable()
export class SsoScopeService {
  /**
   * Resolve a Loops storage namespace for an authenticated user. The selected
   * tenant is a workspace hint, not a permission check; a stable personal
   * workspace keeps every valid login usable without SSO membership setup.
   */
  async resolve(input: { ssoSubject: string; tenantId?: string }): Promise<VerifiedTenantScope> {
    const selectedTenantId = input.tenantId?.trim();

    return {
      tenantId: selectedTenantId || `user:${input.ssoSubject}`,
      tenantName: selectedTenantId || 'Personal workspace',
    };
  }
}
