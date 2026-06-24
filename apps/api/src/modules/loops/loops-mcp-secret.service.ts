import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

/**
 * R38: MCP Provider Secret Management.
 *
 * Resolves secrets for MCP server authentication using env-var references
 * and SSO-backed secret refs. Never stores plaintext secrets — only references.
 *
 * Secret reference formats:
 *   env:VAR_NAME          → process.env[VAR_NAME]
 *   sso:secret_key        → SSO Internal API (placeholder for SSO integration)
 *   file:/path/to/secret  → contents of the file
 *
 * Usage in MCP server config:
 *   authStatus: "configured"
 *   secretRef: "env:MY_MCP_API_KEY"
 */
@Injectable()
export class LoopsMcpSecretService {
  // Sensitive key patterns that should never be logged
  private readonly SENSITIVE_KEYS =
    /token|secret|password|authorization|api[-_]?key|access[-_]?key|private[-_]?key/i;

  constructor(@Optional() @Inject(WINSTON_MODULE_PROVIDER) private readonly logger?: Logger) {}

  /**
   * Resolve a secret reference to its actual value.
   * Returns undefined if the reference cannot be resolved.
   */
  resolve(secretRef: string | undefined): string | undefined {
    if (!secretRef) return undefined;

    // env:VAR_NAME
    if (secretRef.startsWith('env:')) {
      const varName = secretRef.slice(4);
      const value = process.env[varName];
      if (!value) {
        this.logger?.warn(`[McpSecret] Environment variable "${varName}" not set`, { secretRef });
      }
      return value;
    }

    // sso:secret_key — delegated to SSO Internal API (future)
    if (secretRef.startsWith('sso:')) {
      this.logger?.warn(`[McpSecret] SSO secret refs not yet supported; returning undefined`, {
        secretRef,
      });
      return undefined;
    }

    // file:/path/to/secret — read from filesystem
    if (secretRef.startsWith('file:')) {
      try {
        const fs = require('fs');
        const filePath = secretRef.slice(5);
        return fs.readFileSync(filePath, 'utf8').trim();
      } catch (error) {
        this.logger?.warn(`[McpSecret] Failed to read secret file`, { secretRef, error });
        return undefined;
      }
    }

    // Raw value (not recommended but supported for dev)
    if (process.env.NODE_ENV === 'development') {
      return secretRef;
    }

    this.logger?.warn(
      `[McpSecret] Unknown secret reference format, returning undefined in production`,
      { secretRef },
    );
    return undefined;
  }

  /**
   * Build environment variables for MCP client process from secret references.
   * Each entry whose value starts with `env:`, `sso:`, or `file:` is resolved.
   * Entries with raw values are passed through only in development.
   */
  buildEnv(envRefs: Record<string, string> | undefined): Record<string, string> | undefined {
    if (!envRefs || Object.keys(envRefs).length === 0) return undefined;

    const resolved: Record<string, string> = {};
    for (const [key, ref] of Object.entries(envRefs)) {
      const value = this.resolve(ref);
      if (value !== undefined) {
        resolved[key] = value;
      } else {
        this.logger?.warn(`[McpSecret] Could not resolve "${key}" → "${this.redact(ref)}"`, {
          key,
        });
      }
    }
    return Object.keys(resolved).length > 0 ? resolved : undefined;
  }

  /**
   * Redact sensitive values for logging — show only the reference format.
   */
  redact(value: string): string {
    if (this.SENSITIVE_KEYS.test(value)) return '***REDACTED***';
    if (value.startsWith('env:')) return `env:${value.slice(4).replace(/./g, '*')}`;
    return value.startsWith('file:') ? `file:***` : value.slice(0, 8) + '...';
  }
}
