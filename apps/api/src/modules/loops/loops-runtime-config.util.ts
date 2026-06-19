import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { load } from 'js-yaml';
import * as path from 'path';

export type LoopsRuntimeConfig = {
  maxRetry: number;
  maxReloop: number;
  shardTimeoutSec: number;
  cost: {
    tokenCapPerLoop: number;
    callCapPerLoop: number;
  };
  tests: {
    defaultCommands: string[];
  };
};

type ParsedLoopsRuntimeConfig = {
  maxRetry?: number;
  maxReloop?: number;
  shardTimeoutSec?: number;
  cost: Partial<LoopsRuntimeConfig['cost']>;
  tests: {
    defaultCommands: string[];
  };
};

const DEFAULT_RUNTIME_CONFIG: LoopsRuntimeConfig = {
  maxRetry: 2,
  maxReloop: 3,
  shardTimeoutSec: 900,
  cost: {
    tokenCapPerLoop: 5000000,
    callCapPerLoop: 500,
  },
  tests: {
    defaultCommands: ['pnpm --version'],
  },
};

export async function readLoopsRuntimeConfig(): Promise<LoopsRuntimeConfig> {
  const content = await fs
    .readFile(path.join(findWorkspaceRoot(), '.loops', 'config.yaml'), 'utf8')
    .catch(() => '');
  const parsed = parseLoopsRuntimeConfig(content);
  return {
    maxRetry: parsed.maxRetry ?? DEFAULT_RUNTIME_CONFIG.maxRetry,
    maxReloop: parsed.maxReloop ?? DEFAULT_RUNTIME_CONFIG.maxReloop,
    shardTimeoutSec: parsed.shardTimeoutSec ?? DEFAULT_RUNTIME_CONFIG.shardTimeoutSec,
    cost: {
      tokenCapPerLoop: parsed.cost.tokenCapPerLoop ?? DEFAULT_RUNTIME_CONFIG.cost.tokenCapPerLoop,
      callCapPerLoop: parsed.cost.callCapPerLoop ?? DEFAULT_RUNTIME_CONFIG.cost.callCapPerLoop,
    },
    tests: {
      defaultCommands: parsed.tests.defaultCommands.length
        ? parsed.tests.defaultCommands
        : DEFAULT_RUNTIME_CONFIG.tests.defaultCommands,
    },
  };
}

function parseLoopsRuntimeConfig(content: string): ParsedLoopsRuntimeConfig {
  if (!content.trim()) {
    return {
      cost: {},
      tests: {
        defaultCommands: [],
      },
    };
  }

  const raw = load(content) as Record<string, unknown> | undefined;
  const cost = asRecord(raw?.cost);
  const tests = asRecord(raw?.tests);
  const defaultCommands = Array.isArray(tests?.default_commands)
    ? tests.default_commands.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];

  return {
    maxRetry: asNonNegativeInteger(raw?.max_retry),
    maxReloop: asNonNegativeInteger(raw?.max_reloop),
    shardTimeoutSec: asPositiveNumber(raw?.shard_timeout_sec),
    cost: {
      tokenCapPerLoop: asPositiveNumber(cost?.token_cap_per_loop),
      callCapPerLoop: asPositiveNumber(cost?.call_cap_per_loop),
    },
    tests: {
      defaultCommands,
    },
  };
}

function findWorkspaceRoot() {
  let current = process.cwd();
  while (current !== path.dirname(current)) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function asNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}
