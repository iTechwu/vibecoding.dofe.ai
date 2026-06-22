import axios from 'axios';
import * as https from 'https';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const LOCAL_LIKE_ENVS = new Set(['dev', 'development', 'test', 'local']);

function hostnameAllowsInsecureTls(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized.endsWith('.test.dofe.ai') ||
    normalized.endsWith('.local.dofe.ai')
  );
}

export function allowInsecureSsoTls(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = (env.SSO_ALLOW_INSECURE_TLS ?? '').toLowerCase();
  if (explicit) return TRUE_VALUES.has(explicit);

  const nodeEnv = (env.NODE_ENV ?? 'dev').toLowerCase();
  if (!LOCAL_LIKE_ENVS.has(nodeEnv)) return false;

  const issuer = env.SSO_ISSUER ?? env.SSO_API_URL ?? '';
  try {
    return hostnameAllowsInsecureTls(new URL(issuer).hostname);
  } catch {
    return false;
  }
}

export function configureInsecureSsoTls(): void {
  if (!allowInsecureSsoTls()) return;

  axios.defaults.httpsAgent = new https.Agent({ rejectUnauthorized: false });
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
