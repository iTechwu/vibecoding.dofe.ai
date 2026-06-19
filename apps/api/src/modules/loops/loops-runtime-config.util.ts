import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { load } from 'js-yaml';
import * as path from 'path';

export type LoopsRuntimeConfig = {
  contextBudget: number;
  maxParallel: number;
  maxRetry: number;
  maxReloop: number;
  maxShardRedo: number;
  shardTimeoutSec: number;
  cost: {
    tokenCapPerLoop: number;
    callCapPerLoop: number;
  };
  tests: {
    defaultCommands: string[];
    allowedCommands: string[];
    coverageFloor: {
      lines?: number;
      branches?: number;
    };
  };
};

type ParsedLoopsRuntimeConfig = {
  contextBudget?: number;
  maxParallel?: number;
  maxRetry?: number;
  maxReloop?: number;
  maxShardRedo?: number;
  shardTimeoutSec?: number;
  cost: Partial<LoopsRuntimeConfig['cost']>;
  tests: {
    defaultCommands: string[];
    allowedCommands: string[];
    coverageFloor: {
      lines?: number;
      branches?: number;
    };
  };
};

const DEFAULT_RUNTIME_CONFIG: LoopsRuntimeConfig = {
  contextBudget: 24000,
  maxParallel: 1,
  maxRetry: 2,
  maxReloop: 3,
  maxShardRedo: 3,
  shardTimeoutSec: 900,
  cost: {
    tokenCapPerLoop: 5000000,
    callCapPerLoop: 500,
  },
  tests: {
    defaultCommands: ['pnpm --version'],
    allowedCommands: [],
    coverageFloor: {},
  },
};

export async function readLoopsRuntimeConfig(): Promise<LoopsRuntimeConfig> {
  const content = await fs
    .readFile(path.join(findWorkspaceRoot(), '.loops', 'config.yaml'), 'utf8')
    .catch(() => '');
  const parsed = parseLoopsRuntimeConfig(content);
  return {
    contextBudget: parsed.contextBudget ?? DEFAULT_RUNTIME_CONFIG.contextBudget,
    maxParallel: parsed.maxParallel ?? DEFAULT_RUNTIME_CONFIG.maxParallel,
    maxRetry: parsed.maxRetry ?? DEFAULT_RUNTIME_CONFIG.maxRetry,
    maxReloop: parsed.maxReloop ?? DEFAULT_RUNTIME_CONFIG.maxReloop,
    maxShardRedo: parsed.maxShardRedo ?? DEFAULT_RUNTIME_CONFIG.maxShardRedo,
    shardTimeoutSec: parsed.shardTimeoutSec ?? DEFAULT_RUNTIME_CONFIG.shardTimeoutSec,
    cost: {
      tokenCapPerLoop: parsed.cost.tokenCapPerLoop ?? DEFAULT_RUNTIME_CONFIG.cost.tokenCapPerLoop,
      callCapPerLoop: parsed.cost.callCapPerLoop ?? DEFAULT_RUNTIME_CONFIG.cost.callCapPerLoop,
    },
    tests: {
      defaultCommands: parsed.tests.defaultCommands.length
        ? parsed.tests.defaultCommands
        : DEFAULT_RUNTIME_CONFIG.tests.defaultCommands,
      allowedCommands: parsed.tests.allowedCommands.length
        ? parsed.tests.allowedCommands
        : parsed.tests.defaultCommands.length
          ? parsed.tests.defaultCommands
          : DEFAULT_RUNTIME_CONFIG.tests.defaultCommands,
      coverageFloor: {
        lines: parsed.tests.coverageFloor.lines,
        branches: parsed.tests.coverageFloor.branches,
      },
    },
  };
}

function parseLoopsRuntimeConfig(content: string): ParsedLoopsRuntimeConfig {
  if (!content.trim()) {
    return {
      cost: {},
      tests: {
        defaultCommands: [],
        allowedCommands: [],
        coverageFloor: {},
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
  const allowedCommands = Array.isArray(tests?.allowed_commands)
    ? tests.allowed_commands.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];
  const coverageFloor = asRecord(tests?.coverage_floor);

  return {
    contextBudget: asPositiveNumber(raw?.context_budget),
    maxParallel: asPositiveInteger(raw?.max_parallel),
    maxRetry: asNonNegativeInteger(raw?.max_retry),
    maxReloop: asNonNegativeInteger(raw?.max_reloop),
    maxShardRedo: asNonNegativeInteger(raw?.max_shard_redo),
    shardTimeoutSec: asPositiveNumber(raw?.shard_timeout_sec),
    cost: {
      tokenCapPerLoop: asPositiveNumber(cost?.token_cap_per_loop),
      callCapPerLoop: asPositiveNumber(cost?.call_cap_per_loop),
    },
    tests: {
      defaultCommands,
      allowedCommands,
      coverageFloor: {
        lines: asPercentage(coverageFloor?.lines),
        branches: asPercentage(coverageFloor?.branches),
      },
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

function asPercentage(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : undefined;
}

function asNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function asPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}
