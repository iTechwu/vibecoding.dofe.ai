import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

type ResolvedAddress = { address: string; family: number };

type TargetUrlPolicyOptions = {
  env?: NodeJS.ProcessEnv;
  resolveHost?: (hostname: string) => Promise<ResolvedAddress[]>;
};

const LOCAL_LIKE_ENVS = new Set(['dev', 'development', 'test', 'local']);
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

/**
 * Validates URLs that make the Loops backend or Browser QA worker issue network
 * requests. Production requires an explicit hostname allowlist, while all
 * resolved addresses are checked for SSRF-sensitive network ranges.
 */
export async function assertLoopTargetUrlAllowed(
  rawUrl: string,
  options: TargetUrlPolicyOptions = {},
): Promise<URL> {
  const env = options.env ?? process.env;
  const target = parseTargetUrl(rawUrl);
  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  const localLike = LOCAL_LIKE_ENVS.has((env.NODE_ENV ?? 'dev').toLowerCase());
  const allowedHosts = parseAllowedHosts(env.LOOPS_TARGET_URL_ALLOWLIST);

  if (!localLike && target.protocol !== 'https:') {
    throw new BadRequestException('Loop target URL must use HTTPS outside local environments.');
  }
  if (!localLike && allowedHosts.length === 0) {
    throw new BadRequestException(
      'LOOPS_TARGET_URL_ALLOWLIST must list the release canary target hostname in production.',
    );
  }
  if (allowedHosts.length > 0 && !allowedHosts.includes(hostname)) {
    throw new BadRequestException('Loop target URL hostname is not allowlisted.');
  }

  const allowPrivate =
    localLike && TRUE_VALUES.has((env.LOOPS_ALLOW_PRIVATE_TARGET_URLS ?? '').toLowerCase());
  const addresses = await resolveTargetAddresses(hostname, options.resolveHost);
  if (!allowPrivate && addresses.some((address) => !isPublicAddress(address.address))) {
    throw new BadRequestException(
      'Loop target URL must not resolve to a private, loopback, link-local, or reserved address.',
    );
  }

  return target;
}

function parseTargetUrl(rawUrl: string): URL {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Loop target URL must be a valid HTTP(S) URL.');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new BadRequestException('Loop target URL must use HTTP or HTTPS.');
  }
  if (target.username || target.password) {
    throw new BadRequestException('Loop target URL must not contain credentials.');
  }
  return target;
}

function parseAllowedHosts(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveTargetAddresses(
  hostname: string,
  resolveHost: TargetUrlPolicyOptions['resolveHost'],
): Promise<ResolvedAddress[]> {
  if (isIP(hostname)) {
    return [{ address: hostname, family: isIP(hostname) }];
  }
  try {
    const addresses = await (resolveHost ?? defaultResolveHost)(hostname);
    if (addresses.length === 0) throw new Error('no records');
    return addresses;
  } catch {
    throw new BadRequestException('Loop target URL hostname could not be resolved safely.');
  }
}

async function defaultResolveHost(hostname: string): Promise<ResolvedAddress[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  const [first, second] = octets;
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;
  if (first === 10 || first === 127 || first === 0 || first >= 224) return false;
  if (first === 100 && second >= 64 && second <= 127) return false;
  if (first === 169 && second === 254) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  if (first === 192 && (second === 0 || second === 168)) return false;
  if (first === 198 && (second === 18 || second === 19 || second === 51)) return false;
  if (first === 203 && second === 0) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPublicIpv4(mappedIpv4);
  // Global unicast is 2000::/3. This excludes private, link-local, loopback,
  // multicast, documentation and other reserved ranges by default.
  return /^[23]/.test(normalized) && !normalized.startsWith('2001:db8');
}
