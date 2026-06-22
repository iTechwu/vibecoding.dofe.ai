import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type ProcessRunOptions = {
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
  maxBuffer?: number;
  retries?: number;
  retryDelayMs?: number;
};

export type ProcessRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  attempts: number;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BUFFER = 1024 * 1024 * 8;

/**
 * 受控子进程执行：超时 kill、捕获 stdout/stderr/exitCode/duration。
 * 供 Codex / Claude Code / Git 的 headless CLI Adapter 复用（07 §1/§3/§9）。
 */
export async function runProcess(options: ProcessRunOptions): Promise<ProcessRunResult> {
  const maxAttempts = Math.max(1, 1 + Math.max(0, options.retries ?? 0));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 500);
  let lastResult: ProcessRunResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastResult = await runProcessOnce(options, attempt);
    if (lastResult.exitCode === 0) {
      return lastResult;
    }
    if (attempt < maxAttempts) {
      await sleep(retryDelayMs * attempt);
    }
  }

  return lastResult as ProcessRunResult;
}

async function runProcessOnce(
  options: ProcessRunOptions,
  attempt: number,
): Promise<ProcessRunResult> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const result = await execFileAsync(options.command, options.args, {
      cwd: options.cwd,
      timeout: timeoutMs,
      maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
      env: { ...process.env, ...options.env },
    });
    return {
      exitCode: 0,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      durationMs: Date.now() - started,
      timedOut: false,
      attempts: attempt,
    };
  } catch (error) {
    const err = error as {
      code?: number | string;
      signal?: string;
      stdout?: string;
      stderr?: string;
      message?: string;
      killed?: boolean;
    };
    const timedOut = err.signal === 'SIGTERM' || err.killed === true;
    const exitCode =
      typeof err.code === 'number'
        ? err.code
        : typeof err.code === 'string'
          ? Number(err.code) || 1
          : 1;
    return {
      exitCode,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message ?? err.signal ?? 'process failed',
      durationMs: Date.now() - started,
      timedOut,
      attempts: attempt,
    };
  }
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 从 CLI/LLM 自由文本中健壮地抽取首个 JSON 值（对象或数组）。
 *
 * 比"首括号 + `lastIndexOf` 尾括号"更稳，避免两类常见误判：
 * 1. LLM 输出常带 markdown 代码围栏（` ```json … ``` `）与前后提示语；
 * 2. 对象之后还有尾随的 `}` `]` 等字符时，`lastIndexOf` 会把结束位置算错。
 *
 * 处理：剥离围栏 → 深度感知括号扫描（识别字符串与转义）定位首个完整 JSON
 * 值的结束 → `JSON.parse`；失败再回退移除尾随逗号。
 *
 * `extractJson` 为历史别名，保持既有调用点不变。
 */
export function extractJson<T = unknown>(raw: string): T | undefined {
  return parseJsonLoose<T>(raw);
}

export function parseJsonLoose<T = unknown>(raw: string): T | undefined {
  if (!raw) return undefined;
  const cleaned = stripCodeFences(raw).trim();
  const begin = firstJsonBoundary(cleaned);
  if (begin === -1) return undefined;
  const end = matchJsonBoundary(cleaned, begin);
  if (end === -1) return undefined;
  const slice = cleaned.slice(begin, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    // 容忍尾随逗号（LLM 常见错误）。
    const repaired = slice.replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(repaired) as T;
    } catch {
      return undefined;
    }
  }
}

function stripCodeFences(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence ? fence[1] : raw;
}

function firstJsonBoundary(text: string): number {
  const obj = text.indexOf('{');
  const arr = text.indexOf('[');
  if (obj === -1) return arr;
  if (arr === -1) return obj;
  return Math.min(obj, arr);
}

/** 深度感知扫描：从 `begin` 的开括号找到其匹配的闭括号（忽略字符串/转义内的括号）。 */
function matchJsonBoundary(text: string, begin: number): number {
  const open = text[begin];
  const close = open === '{' ? '}' : open === '[' ? ']' : '';
  if (!close) return -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = begin; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}
