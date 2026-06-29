/**
 * OIDC App Base URL Resolver
 *
 * Resolves THIS app's own API / frontend base URLs from `app.*` config
 * (dynamic subdomain/port for dev vs prod). These are INPUTS to the SDK's
 * `resolveOidcUrls()` (which constructs the SSO provider endpoints +
 * redirect_uri/success_url from `issuerUrl`/`appBaseUrl`/`frontendOrigin`),
 * not a duplicate of it. The two are complementary:
 *   - this resolver  → "where is THIS app hosted?"  (app.apiBaseUrl / app.frontendBaseUrl)
 *   - resolveOidcUrls → "where is the SSO provider, and what is the OAuth redirect_uri?"
 *
 * When adopting `SsoOidcRelyingPartyModule`, feed the values resolved here
 * into `OidcRpModuleOptions.appBaseUrl` / `frontendOrigin`.
 *
 * @see resolveOidcUrls in @dofe/sso-nestjs
 */
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

function cleanEnvUrl(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? cleanUrl(value) : undefined;
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
  const envUrl =
    cleanEnvUrl('VIBECODING_APP_BASE_URL') ??
    cleanEnvUrl('APP_BASE_URL') ??
    cleanEnvUrl('OIDC_APP_BASE_URL');
  if (envUrl) return envUrl;
  if (cfg.baseUrl) return cleanUrl(cfg.baseUrl);

  const configuredUrl = resolveConfiguredDomainUrl(cfg.apiSubDomain, cfg.domain);
  if (configuredUrl) return configuredUrl;

  return `http://127.0.0.1:${cfg.port ?? 13100}`;
}

export function resolveOidcFrontendBaseUrl(configService: ConfigService): string {
  const cfg = getAppConfig(configService);
  const envUrl =
    cleanEnvUrl('VIBECODING_APP_FRONTEND_URL') ??
    cleanEnvUrl('APP_FRONTEND_URL') ??
    cleanEnvUrl('OIDC_APP_FRONTEND_URL');
  if (envUrl) return envUrl;
  if (cfg.frontendUrl) return cleanUrl(cfg.frontendUrl);

  const configuredUrl = resolveConfiguredDomainUrl(cfg.subDomain, cfg.domain);
  if (configuredUrl) return configuredUrl;

  return `http://127.0.0.1:${cfg.frontendPort ?? 3003}`;
}
