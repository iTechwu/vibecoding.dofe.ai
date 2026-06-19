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

/** 从 CLI 的自由文本/JSON 输出中尽量抽出第一个 JSON 对象。 */
export function extractJson<T = unknown>(raw: string): T | undefined {
  if (!raw) return undefined;
  const start = raw.indexOf('{');
  const startArr = raw.indexOf('[');
  let begin = -1;
  if (start === -1) begin = startArr;
  else if (startArr === -1) begin = start;
  else begin = Math.min(start, startArr);
  if (begin === -1) return undefined;
  const open = raw[begin];
  const close = open === '{' ? '}' : ']';
  const end = raw.lastIndexOf(close);
  if (end <= begin) return undefined;
  try {
    return JSON.parse(raw.slice(begin, end + 1)) as T;
  } catch {
    return undefined;
  }
}
