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

const DEFAULT_OIDC_SCOPES = 'openid profile email tenant offline_access';
const OIDC_SCOPE_TOKEN = /^[A-Za-z0-9._:-]+$/;

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

export function resolveOidcRedirectUri(configService: ConfigService): string {
  const configuredRedirectUri = configService.get<string>('SSO_REDIRECT_URI')?.trim();
  if (configuredRedirectUri) {
    const redirectUri = new URL(configuredRedirectUri);
    if (redirectUri.protocol !== 'https:' && redirectUri.protocol !== 'http:') {
      throw new Error('SSO_REDIRECT_URI must use the http or https scheme');
    }
    if (redirectUri.username || redirectUri.password || redirectUri.hash) {
      throw new Error('SSO_REDIRECT_URI must not include credentials or a fragment');
    }
    return redirectUri.toString();
  }

  return `${resolveOidcApiBaseUrl(configService)}/auth/oidc/callback`;
}

export function resolveOidcScopes(configService: ConfigService): string {
  const configuredScopes = configService.get<string>('SSO_SCOPES')?.trim();
  const scopes = (configuredScopes || DEFAULT_OIDC_SCOPES).split(/\s+/);

  if (
    !scopes.includes('openid') ||
    !scopes.includes('tenant') ||
    scopes.some((scope) => !OIDC_SCOPE_TOKEN.test(scope)) ||
    new Set(scopes).size !== scopes.length
  ) {
    throw new Error(
      'SSO_SCOPES must contain openid and tenant plus unique scope tokens using letters, numbers, dot, underscore, colon, or hyphen',
    );
  }

  return scopes.join(' ');
}
