import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import type { Logger } from 'winston';

const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    code: z.union([z.number(), z.string()]),
    msg: z.string().optional(),
    data: dataSchema,
  });

const CheckPermissionResponseSchema = ApiResponseSchema(
  z.object({
    hasPermission: z.boolean(),
  }),
);

const UserPermissionsResponseSchema = ApiResponseSchema(
  z.object({
    permissions: z.array(z.string()),
    roles: z.array(z.string()),
  }),
);

@Injectable()
export class SsoPermissionClient {
  private readonly baseUrl: string;
  private readonly internalSecret: string;
  private readonly serviceName: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.baseUrl =
      this.configService.get<string>('SSO_INTERNAL_API_URL') ??
      this.configService.get<string>('SSO_API_URL') ??
      '';
    this.internalSecret = this.configService.get<string>('INTERNAL_API_SECRET') ?? '';
    this.serviceName = this.configService.get<string>('SSO_SERVICE_NAME') ?? 'vibecoding.dofe.ai';

    if (!this.baseUrl) {
      throw new Error('SSO_INTERNAL_API_URL or SSO_API_URL is required.');
    }
    if (!this.internalSecret) {
      throw new Error('INTERNAL_API_SECRET is required.');
    }
  }

  async checkPermission(userId: string, permission: string, teamId?: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/internal/permissions/check`, {
        headers: this.headers(),
        params: { userId, permission, ...(teamId ? { teamId } : {}) },
        timeout: 5000,
        validateStatus: () => true,
      }),
    );

    if (response.status < 200 || response.status >= 300) {
      this.logger.warn('[SsoPermissionClient] Permission check returned non-2xx', {
        status: response.status,
        userId,
        permission,
        teamId,
      });
      return false;
    }

    return CheckPermissionResponseSchema.parse(response.data).data.hasPermission;
  }

  async getUserPermissions(
    userId: string,
    teamId?: string,
  ): Promise<{ permissions: string[]; roles: string[] }> {
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.baseUrl}/internal/users/${encodeURIComponent(userId)}/permissions`,
        {
          headers: this.headers(),
          params: { ...(teamId ? { teamId } : {}) },
          timeout: 5000,
          validateStatus: () => true,
        },
      ),
    );

    if (response.status < 200 || response.status >= 300) {
      this.logger.warn('[SsoPermissionClient] Get user permissions returned non-2xx', {
        status: response.status,
        userId,
        teamId,
      });
      return { permissions: [], roles: [] };
    }

    return UserPermissionsResponseSchema.parse(response.data).data;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.internalSecret}`,
      'X-Service-Name': this.serviceName,
      'Content-Type': 'application/json',
    };
  }
}
