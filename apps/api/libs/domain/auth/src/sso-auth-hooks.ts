/**
 * Vibecoding SSO Auth Hooks
 *
 * Implements SsoAuthGuardHooks for the vibecoding project.
 * Wires up blacklist checking, local user resolution, and admin flag resolution.
 *
 * @see @dofe/sso-nestjs/sso-auth.types
 */
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@dofe/infra-redis';
import { TOKEN_BLACKLIST_PREFIX } from '@dofe/sso-contracts/token';
import type { SsoAuthGuardHooks, LocalUser } from '@dofe/sso-nestjs';
import { UserSyncService } from './user-sync.service';

@Injectable()
export class VibecodingSsoAuthHooks implements SsoAuthGuardHooks {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly userSync: UserSyncService,
  ) {}

  async isBlacklisted(accessToken: string): Promise<boolean> {
    try {
      const decoded = this.jwtService.decode(accessToken, {
        complete: false,
      }) as Record<string, unknown> | null;
      const jti = typeof decoded?.jti === 'string' ? decoded.jti : undefined;
      if (!jti) return false;

      const blacklisted = await this.redisService.get(`${TOKEN_BLACKLIST_PREFIX}${jti}`);
      return !!blacklisted;
    } catch {
      return false;
    }
  }

  async resolveLocalUser(ssoSub: string, _claims: Record<string, unknown>): Promise<LocalUser> {
    const user = await this.userSync.ensureLocalUserExists(ssoSub);
    return {
      id: user.id,
      nickname: user.nickname ?? null,
      code: user.code ?? null,
      sex: user.sex ?? null,
      isAdmin: user.isAdmin ?? false,
    };
  }

  resolveIsAdmin(localUser: LocalUser, _claims: Record<string, unknown>): boolean {
    return localUser.isAdmin;
  }
}
