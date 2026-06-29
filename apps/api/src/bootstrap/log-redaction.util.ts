import * as winston from 'winston';

/**
 * Application-layer log secret redaction (0629 · OPZ-03).
 *
 * Connection URLs such as `amqp://dofe:password@host`, `redis://:secret@host`,
 * or `postgres://user:pass@host` are logged by upstream infra packages
 * (`@dofe/infra-rabbitmq` injects the shared `WINSTON_MODULE_PROVIDER` logger,
 * so its connection/shutdown logs flow through the logger configured here).
 * The upstream package should mask credentials itself, but until it does this
 * format is the repository-owned defense layer: it rewrites the
 * `scheme://user:pass@` authority to `scheme://***@` before any transport sees
 * the message, while preserving host/port/path for diagnostics.
 */

const SECRET_URL_PATTERN = /([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^\s:/@]*):([^\s/@]+)@/g;

/** Mask the `user:pass@` authority of a credential-bearing URL string. */
export function redactSecretUrlsInText(value: string): string {
  return value.replace(SECRET_URL_PATTERN, '$1://***@');
}

/** Recursively redact credential URLs in strings inside arbitrary log meta. */
export function redactSecretUrlsDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (typeof value === 'string') {
    const redacted = redactSecretUrlsInText(value);
    return redacted === value ? value : redacted;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const redacted = redactSecretUrlsDeep(item, depth + 1);
      if (redacted !== item) changed = true;
      return redacted;
    });
    return changed ? next : value;
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const redacted = redactSecretUrlsDeep(item, depth + 1);
      if (redacted !== item) changed = true;
      next[key] = redacted;
    }
    return changed ? next : value;
  }
  return value;
}

/**
 * Winston format that masks credential URLs in both the top-level `message`
 * and any nested meta fields (e.g. `error.message`, connection metadata) before
 * the logger's base format runs.
 */
export const redactSecretUrls = winston.format((info) => {
  if (typeof info === 'object' && info !== null) {
    const record = info as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const value = record[key];
      const redacted = redactSecretUrlsDeep(value);
      if (redacted !== value) record[key] = redacted;
    }
  }
  return info;
});
