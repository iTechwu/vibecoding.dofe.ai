import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { promisify } from 'util';
import type { LoopBrowserQaReport, LoopBrowserQaRequest } from '@repo/contracts';
import { resolveAllowedTargetRepo } from './loops-path-policy.util';

const execFileAsync = promisify(execFile);
const OUTPUT_LIMIT = 8000;

type BrowserQaWorkerResult = {
  title?: string;
  consoleErrors: string[];
  networkFailures: Array<{ url: string; status?: number }>;
  visualStatus: 'baseline-created' | 'matched' | 'changed';
};

@Injectable()
export class LoopsBrowserQaWorkerService {
  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
  ) {}

  async run(input: {
    issueId: string;
    reportId: string;
    targetRepo: string;
    request: LoopBrowserQaRequest;
    screenshotPath: string;
    screenshotRef: string;
    tracePath: string;
    traceRef: string;
    baselinePath: string;
    baselineRef: string;
    diffPath: string;
    diffRef: string;
    handoffPath: string;
    handoffRef: string;
    createdAt?: string;
  }): Promise<LoopBrowserQaReport> {
    const created = input.createdAt ?? new Date().toISOString();
    const outputPath = path.join(tmpdir(), `${input.reportId}-${randomUUID().slice(0, 8)}.json`);
    const started = Date.now();
    const command = 'pnpm --filter @repo/web exec node -e <browser-qa-worker>';

    try {
      const cwd = await resolveAllowedTargetRepo(input.targetRepo);
      await fs.mkdir(path.dirname(input.screenshotPath), { recursive: true });
      await execFileAsync('pnpm', ['--filter', '@repo/web', 'exec', 'node', '-e', this.script()], {
        cwd,
        env: {
          ...process.env,
          LOOPS_BROWSER_QA_INPUT: JSON.stringify({
            targetUrl: input.request.targetUrl,
            screenshotPath: input.screenshotPath,
            tracePath: input.tracePath,
            baselinePath: input.baselinePath,
            diffPath: input.diffPath,
            handoffPath: input.handoffPath,
            outputPath,
          }),
        },
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 8,
      });
      const result = JSON.parse(await fs.readFile(outputPath, 'utf8')) as BrowserQaWorkerResult;
      const status =
        result.consoleErrors.length > 0 || result.networkFailures.length > 0 ? 'failed' : 'passed';
      return {
        id: input.reportId,
        issueId: input.issueId,
        runner: 'playwright-cli',
        status,
        targetUrl: input.request.targetUrl,
        title: result.title,
        screenshots: [{ path: input.screenshotRef, label: 'page-load' }],
        traces: [{ path: input.traceRef, label: 'page-load' }],
        visualDiffs: [
          {
            baselinePath: input.baselineRef,
            actualPath: input.screenshotRef,
            diffPath: result.visualStatus === 'changed' ? input.diffRef : undefined,
            status: result.visualStatus,
            label: 'page-load',
          },
        ],
        handoffs: [{ path: input.handoffRef, label: 'playwright-context' }],
        consoleErrors: result.consoleErrors,
        networkFailures: result.networkFailures,
        checkedFlows: input.request.checkedFlows,
        command,
        durationMs: Date.now() - started,
        created,
      };
    } catch (error) {
      const reason = this.errorMessage(error);
      this.logger?.warn('[Loops] Browser QA worker blocked', {
        issueId: input.issueId,
        targetUrl: input.request.targetUrl,
        reason,
      });
      return {
        id: input.reportId,
        issueId: input.issueId,
        runner: 'playwright-cli',
        status: 'blocked',
        targetUrl: input.request.targetUrl,
        screenshots: [],
        consoleErrors: [],
        networkFailures: [],
        checkedFlows: input.request.checkedFlows,
        blockedReason: reason,
        command,
        durationMs: Date.now() - started,
        created,
      };
    } finally {
      await fs.rm(outputPath, { force: true }).catch(() => undefined);
    }
  }

  private errorMessage(error: unknown): string {
    const err = error as { stderr?: string; stdout?: string; message?: string };
    return this.truncate(err.stderr ?? err.stdout ?? err.message ?? String(error));
  }

  private truncate(value: string): string {
    if (value.length <= OUTPUT_LIMIT) return value;
    return `${value.slice(0, OUTPUT_LIMIT)}\n[truncated ${value.length - OUTPUT_LIMIT} chars]`;
  }

  private script(): string {
    return `
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const input = JSON.parse(process.env.LOOPS_BROWSER_QA_INPUT || '{}');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const consoleErrors = [];
  const networkFailures = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      networkFailures.push({ url: response.url(), status: response.status() });
    }
  });
  await page.goto(input.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.screenshot({ path: input.screenshotPath, fullPage: true });
  const title = await page.title();
  await context.tracing.stop({ path: input.tracePath });
  await browser.close();
  let visualStatus = 'baseline-created';
  if (fs.existsSync(input.baselinePath)) {
    const baseline = fs.readFileSync(input.baselinePath);
    const actual = fs.readFileSync(input.screenshotPath);
    visualStatus = baseline.equals(actual) ? 'matched' : 'changed';
    if (visualStatus === 'changed') {
      fs.copyFileSync(input.screenshotPath, input.diffPath);
    }
  } else {
    fs.copyFileSync(input.screenshotPath, input.baselinePath);
  }
  fs.writeFileSync(input.handoffPath, JSON.stringify({
    targetUrl: input.targetUrl,
    title,
    screenshotPath: input.screenshotPath,
    tracePath: input.tracePath,
    visualStatus,
    consoleErrors,
    networkFailures,
    created: new Date().toISOString(),
  }, null, 2));
  fs.writeFileSync(input.outputPath, JSON.stringify({ title, consoleErrors, networkFailures, visualStatus }));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
`;
  }
}
