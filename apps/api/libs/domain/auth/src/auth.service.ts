import { Injectable } from '@nestjs/common';
import { AuthClient } from '@app/auth';
import { stringUtil } from '@dofe/infra-utils';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@dofe/infra-redis';
import { UserInfo } from '@prisma/client';
import { UserInfoService, FileSourceService } from '@app/db';
import { FastifyRequest } from 'fastify';
import { DoFeApp, apiError } from '@dofe/infra-common';
import { UserErrorCode, CommonErrorCode } from '@repo/contracts/errors';
import { LoginSuccess } from '@repo/contracts';
import { FileCdnClient } from '@dofe/infra-clients';

@Injectable()
export class AuthService {
  constructor(
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly user: UserInfoService,
    private readonly fileSource: FileSourceService,
    private readonly fileCdn: FileCdnClient,
  ) {}

  /**
   * 登录成功后的处理函数
   *
   * @param user 用户信息
   * @returns 登录成功后的结果信息
   */
  async loginSuccess(
    user: Partial<UserInfo>,
    deviceInfo: DoFeApp.HeaderData,
  ): Promise<LoginSuccess> {
    return await this.refreshTokenByUser(user, deviceInfo);
  }

  extractTokenFromHeader(request: FastifyRequest): string | undefined {
    const authorizationHeader = request.headers['authorization'] as
      | string
      | undefined;
    if (!authorizationHeader) return undefined;
    const [type, token] = authorizationHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  async getUserId(access: string): Promise<string | null> {
    const userId = await this.redis.getData('access', access);
    if (!userId) return null;
    return userId;
  }

  async getUserSession(userId: string): Promise<AuthClient.Session | null> {
    const session: AuthClient.Session = await this.redis.getData(
      'session',
      userId,
    );
    if (!session) return null;
    return session;
  }

  async getUserSessionByRefresh(refresh: string): Promise<AuthClient.Session | null> {
    const userId = await this.redis.getData('refresh', refresh);
    if (!userId) return null;
    return (await this.redis.getData('session', userId)) as AuthClient.Session;
  }

  async getUserSessionByAccess(access: string): Promise<AuthClient.Session | null> {
    const userId = await this.redis.getData('access', access);
    if (!userId) return null;
    return (await this.redis.getData('session', userId)) as AuthClient.Session;
  }

  /**
   * 移除原先的会话
   *
   * @param userId 用户ID
   * @returns 返回新生成的AuthClient.Session对象
   */
  async removeSessions(userId: string): Promise<void> {
    const prev = await this.redis.getData('session', userId);
    if (prev) {
      await this.redis.deleteData('refresh', prev.refresh);
    }
  }

  async refreshTokenByUser(
    user: Partial<UserInfo>,
    deviceInfo: DoFeApp.HeaderData,
  ): Promise<LoginSuccess> {
    const tokens: AuthClient.Session = await this.generateTokens(user);

    await this.redis.saveData('session', tokens.userId, tokens);
    await this.redis.saveData('refresh', tokens.refresh, tokens.userId);
    await this.redis.saveData('access', tokens.access, tokens.userId);

    // Convert avatarFileId to headerImg URL
    let headerImg: string | null = null;
    if (user.avatarFileId) {
      const avatarFile = await this.fileSource.get({
        id: user.avatarFileId,
      });
      if (avatarFile && avatarFile.vendor && avatarFile.bucket && avatarFile.key) {
        headerImg = await this.fileCdn.getImageVolcengineCdn(
          avatarFile.vendor,
          avatarFile.bucket,
          avatarFile.key,
          '360:360:360:360',
        );
      }
    }

    return {
      refresh: tokens.refresh,
      expire: tokens.expire,
      access: tokens.access,
      accessExpire: tokens.accessExpire,
      isAnonymity: tokens.isAnonymity,
      user: {
        id: user.id!,
        isAnonymity: user.isAnonymity,
        isAdmin: user.isAdmin,
        code: user.code ?? null,
        nickname: user.nickname ?? null,
        headerImg,
        sex: user.sex ?? null,
        mobile: user.mobile ?? null,
        email: user.email ?? null,
      },
    };
  }

  /**
   * 创建匿名用户
   * 根据设备信息创建匿名用户
   *
   * @param deviceInfo 设备信息
   * @returns 创建的匿名用户
   */
  async createAnonyminyUser(
    _deviceInfo: DoFeApp.HeaderData,
  ): Promise<Partial<UserInfo> | null> {
    // TODO: Implement anonymous user creation with new schema
    throw apiError(CommonErrorCode.InternalServerError, {
      message: 'Anonymous user creation not implemented',
    });
  }

  /**
   * 刷新会话
   * 根据 refresh token 刷新用户会话并返回 LoginSuccess 格式的数据
   *
   * @param refresh refresh token
   * @param deviceInfo 设备信息
   * @returns LoginSuccess 格式的登录数据
   */
  async refreshSession(
    refresh: string,
    deviceInfo: DoFeApp.HeaderData,
  ): Promise<LoginSuccess> {
    const session = await this.getUserSessionByRefresh(refresh);
    if (!session || session.isAnonymity) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    const user = await this.user.get({ id: session.userId });
    if (!user) {
      throw apiError(UserErrorCode.UserNotFound);
    }

    return await this.refreshTokenByUser(user, deviceInfo);
  }

  async generateTokens(user: Partial<UserInfo>): Promise<AuthClient.Session> {
    const refresh = stringUtil.stringGen(64);
    const accessTtl = this.redis.getExpireIn('access'); // 10分钟
    const ttl = this.redis.getExpireIn('refresh'); // 30天
    const isAnonymity = user?.isAnonymity;

    // Convert avatarFileId to headerImg URL
    let headerImg: string | undefined;
    if (user.avatarFileId) {
      const avatarFile = await this.fileSource.get({
        id: user.avatarFileId,
      });
      if (avatarFile && avatarFile.vendor && avatarFile.bucket && avatarFile.key) {
        headerImg = await this.fileCdn.getImageVolcengineCdn(
          avatarFile.vendor,
          avatarFile.bucket,
          avatarFile.key,
          '360:360:360:360',
        );
      }
    }

    // 为了与 JWT 标准保持一致，我们选择了 sub 作为属性名来保存 userId
    // 将用户基本信息放入 JWT payload，避免每次都需要查询数据库
    const access = await this.jwt.signAsync({
      sub: user.id,
      isAnonymity: isAnonymity,
      isAdmin: user.isAdmin,
      // 添加常用用户信息字段，避免每次都需要 getUserInfo
      nickname: user.nickname,
      code: user.code,
      headerImg,
      sex: user.sex,
    });
    const now = Date.now();
    const expire = now + ttl * 1000;
    const accessExpire = now + accessTtl * 1000;

    return {
      userId: user.id!,
      refresh,
      access,
      expire,
      accessExpire,
      isAnonymity: isAnonymity ?? false,
    };
  }
}
