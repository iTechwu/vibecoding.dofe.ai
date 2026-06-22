import type { ConfigService } from '@nestjs/config';

type AppUrlConfig = {
  baseUrl?: string;
  frontendUrl?: string;
  domain?: string;
  subDomain?: string;
  apiSubDomain?: string;
  port?: number;
  frontendPort?: number;
};

function cleanUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getAppConfig(configService: ConfigService): AppUrlConfig {
  return {
    baseUrl: configService.get<string>('app.baseUrl'),
    frontendUrl: configService.get<string>('app.frontendUrl'),
    domain: configService.get<string>('app.domain'),
    subDomain: configService.get<string>('app.subDomain'),
    apiSubDomain: configService.get<string>('app.apiSubDomain'),
    port: configService.get<number>('app.port'),
    frontendPort: configService.get<number>('app.frontendPort'),
  };
}

function resolveConfiguredDomainUrl(subDomain: string | undefined, domain: string | undefined) {
  if (!subDomain || !domain) return undefined;
  return `https://${subDomain}.${domain}`;
}

export function resolveOidcApiBaseUrl(configService: ConfigService): string {
  const cfg = getAppConfig(configService);
  if (cfg.baseUrl) return cleanUrl(cfg.baseUrl);

  const configuredUrl = resolveConfiguredDomainUrl(cfg.apiSubDomain, cfg.domain);
  if (configuredUrl) return configuredUrl;

  return `http://127.0.0.1:${cfg.port ?? 13100}`;
}

export function resolveOidcFrontendBaseUrl(configService: ConfigService): string {
  const cfg = getAppConfig(configService);
  if (cfg.frontendUrl) return cleanUrl(cfg.frontendUrl);

  const configuredUrl = resolveConfiguredDomainUrl(cfg.subDomain, cfg.domain);
  if (configuredUrl) return configuredUrl;

  return `http://127.0.0.1:${cfg.frontendPort ?? 3003}`;
}
