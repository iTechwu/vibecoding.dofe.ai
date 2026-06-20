import { Inject, Injectable } from '@nestjs/common';
import { SsoAuthClient } from '@dofe/infra-clients/sso';
import { apiError } from '@dofe/infra-common';
import { UserInfoService } from '@app/db';
import type { UserInfo } from '@prisma/client';
import { CommonErrorCode } from '@repo/contracts/errors';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

@Injectable()
export class UserSyncService {
  constructor(
    private readonly userInfoService: UserInfoService,
    private readonly ssoAuthClient: SsoAuthClient,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async ensureLocalUserExists(ssoSub: string): Promise<UserInfo> {
    const existingUser = await this.userInfoService.get({ ssoSub });
    if (existingUser) return existingUser;

    const legacyUser = await this.userInfoService.getById(ssoSub);
    if (legacyUser) {
      await this.backfillSsoSub(legacyUser.id, ssoSub);
      return legacyUser;
    }

    let ssoUser: {
      id: string;
      nickname?: string | null;
      email?: string | null;
      mobile?: string | null;
      isAdmin?: boolean;
      isActive?: boolean;
    };

    try {
      ssoUser = await this.ssoAuthClient.getUser(ssoSub);
    } catch (error) {
      this.logger.error('Failed to fetch user from SSO', {
        ssoSub,
        error: error instanceof Error ? error.message : String(error),
      });
      throw apiError(CommonErrorCode.UnAuthorized, {
        message: 'SSO user not found or inaccessible',
      });
    }

    if (ssoUser.isActive === false) {
      throw apiError(CommonErrorCode.UnAuthorized, {
        message: 'SSO user account is inactive',
      });
    }

    if (ssoUser.email) {
      const emailUser = await this.userInfoService.get({ email: ssoUser.email });
      if (emailUser) {
        await this.backfillSsoSub(emailUser.id, ssoSub);
        return emailUser;
      }
    }

    try {
      return await this.userInfoService.create({
        id: ssoSub,
        ssoSub,
        nickname: ssoUser.nickname || 'User',
        email: ssoUser.email || undefined,
        mobile: ssoUser.mobile || undefined,
        isAdmin: ssoUser.isAdmin ?? false,
      });
    } catch (createError) {
      this.logger.warn('User create failed, retrying local lookup', {
        ssoSub,
        error: createError instanceof Error ? createError.message : String(createError),
      });

      const retryBySsoSub = await this.userInfoService.get({ ssoSub });
      if (retryBySsoSub) return retryBySsoSub;

      const retryById = await this.userInfoService.getById(ssoSub);
      if (retryById) return retryById;

      if (ssoUser.email) {
        const retryByEmail = await this.userInfoService.get({ email: ssoUser.email });
        if (retryByEmail) return retryByEmail;
      }

      throw apiError(CommonErrorCode.UnAuthorized, {
        message: 'Failed to create local user from SSO',
      });
    }
  }

  private async backfillSsoSub(userId: string, ssoSub: string): Promise<void> {
    try {
      await this.userInfoService.update({ id: userId }, { ssoSub });
    } catch (error) {
      this.logger.warn('Failed to backfill local user ssoSub', {
        userId,
        ssoSub,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
