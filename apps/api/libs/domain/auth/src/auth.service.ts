import { Inject, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { FileClient } from '@dofe/file-sdk';
import type { UserInfo } from '@prisma/client';
import type { LoginSuccess } from '@repo/contracts';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

@Injectable()
export class AuthService {
  constructor(
    private readonly fileClient: FileClient,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  extractTokenFromHeader(request: FastifyRequest): string | undefined {
    const authorizationHeader = request.headers['authorization'] as string | undefined;
    if (!authorizationHeader) return undefined;
    const [type, token] = authorizationHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  async getAvatarUrl(avatarFileId: string): Promise<string | undefined> {
    try {
      const cdnUrl = await this.fileClient.getCdnUrl(avatarFileId);
      if (cdnUrl) return cdnUrl;
    } catch (error) {
      this.logger.debug('File SDK CDN resolve failed', {
        avatarFileId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return undefined;
  }

  async formatLoginResponse(user: Partial<UserInfo>): Promise<{ user: LoginSuccess['user'] }> {
    const headerImg = user.avatarFileId ? await this.getAvatarUrl(user.avatarFileId) : undefined;

    return {
      user: {
        id: user.id!,
        isAnonymity: false,
        isAdmin: user.isAdmin ?? false,
        code: user.code ?? null,
        nickname: user.nickname ?? null,
        headerImg: headerImg ?? null,
        sex: user.sex ?? null,
        mobile: user.mobile ?? null,
        email: user.email ?? null,
      },
    };
  }
}
