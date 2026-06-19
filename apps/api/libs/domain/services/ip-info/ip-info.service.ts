/**
 * IP Info Service
 *
 * 职责：提供 IP 信息查询服务
 * - IP 地址信息查询 (via IpInfoClient)
 * - 国家/地区查询
 * - 大洲查询 (依赖 CountryCodeService)
 * - 时区查询
 *
 * 注意：此服务依赖 CountryCodeService (domain 层)，因此放置在 domain/services 下
 */
import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { RedisService } from '@dofe/infra-redis';
import { FastifyRequest } from 'fastify';
import { ipUtil, validateUtil, environmentUtil } from '@dofe/infra-utils';
import { DoFeApp } from '@dofe/infra-common';
import { CountryCodeService } from '@dofe/infra-shared-db';
import { IpInfoClient } from '@dofe/infra-clients';

@Injectable()
export class IpInfoService {
  protected ipinfoRedisKey = 'ipinfo';
  constructor(
    private readonly redis: RedisService,
    private readonly countryCodeService: CountryCodeService,
    private readonly ipInfoClient: IpInfoClient,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  extractIp(req: FastifyRequest): string {
    return ipUtil.extractIp(req);
  }

  async getIpInfo(ip: string): Promise<Partial<DoFeApp.IPInfo>> {
    if (environmentUtil.getBaseZone() === 'cn') {
      return {
        ip,
        country: 'CN',
        region: 'Beijing',
        city: 'Beijing',
        loc: '1.2897,103.8501',
        timezone: 'Asia/Shanghai',
      };
    } else {
      if (validateUtil.isBlank(ip) || ip === '127.0.0.1') {
        return {
          ip,
          country: 'SG',
          region: 'Singapore',
          city: 'Singapore',
          loc: '1.2897,103.8501',
          timezone: 'Asia/Singapore',
        };
      }
      const ipinfo = await this.redis.getData(this.ipinfoRedisKey, ip);
      if (ipinfo) return ipinfo;
      try {
        const ipInfoData: DoFeApp.IPInfo = await this.ipInfoClient.getIpInfo(ip);
        this.logger.info('IP info:', { ipInfoData });
        await this.redis.saveData(this.ipinfoRedisKey, ip, ipInfoData);
        if (ipInfoData.country === 'CN') {
          return {
            ip,
            country: 'SG',
            region: 'Singapore',
            city: 'Singapore',
            loc: '1.2897,103.8501',
            timezone: 'Asia/Singapore',
          };
        }
        return ipInfoData;
      } catch (error) {
        this.logger.error('Failed to fetch IP info:', error);
        return {
          ip,
          country: 'SG',
          region: 'Singapore',
          city: 'Singapore',
          loc: '1.2897,103.8501',
          timezone: 'Asia/Singapore',
        };
      }
    }
  }

  async getIpCountry(ip: string): Promise<string> {
    const ipInfo = await this.getIpInfo(ip);
    return ipInfo.country ?? 'SG';
  }

  async getContinent(ip: string): Promise<string> {
    const countryCode = await this.getIpCountry(ip);
    const relations = await this.countryCodeService.loadRelations();
    for (const [continent, countries] of Object.entries(relations)) {
      if ((countries as string[]).includes(countryCode)) {
        return continent;
      }
    }
    this.logger.error('Failed to fetch IP continent', ip, countryCode);
    return environmentUtil.getBaseZone();
  }

  async getTimeZone(ip: string): Promise<string> {
    const ipInfo = await this.getIpInfo(ip);
    return ipInfo.timezone ?? 'Asia/Singapore';
  }
}
