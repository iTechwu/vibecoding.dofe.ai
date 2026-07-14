import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { CURRENT_TENANT_HEADER } from '@dofe/infra-contracts';
import { SsoScopeService } from '@app/auth/sso-scope.service';
import type { AuthenticatedRequest } from '@app/auth/types/auth.interface';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Loops uses an authenticated-user access model. This guard assigns a stable
 * workspace namespace but does not make an SSO membership or RBAC decision.
 */
@Injectable()
export class LoopsTenantAccessGuard implements CanActivate {
  constructor(private readonly ssoScopeService: SsoScopeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const scope = await this.ssoScopeService.resolve({
      ssoSubject: request.ssoSub,
      tenantId: request.tenantId ?? firstHeaderValue(request.headers[CURRENT_TENANT_HEADER]),
    });

    request.tenantId = scope.tenantId;
    return true;
  }
}
