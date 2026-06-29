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
import { resolveAllowedTargetRepo } from '@app/services/loops-store';
import { runVisualRegression } from './loops-visual-regression.util';

const execFileAsync = promisify(execFile);
const OUTPUT_LIMIT = 8000;
export const BROWSER_QA_NAVIGATION_CANCELLED_PATTERN_SOURCE =
  'ERR_ABORTED|AbortError|NS_BINDING_ABORTED|cancelled|canceled';
export const BROWSER_QA_NAVIGATION_CANCELLED_PATTERN_FLAGS = 'i';
export const BROWSER_QA_NAVIGATION_CANCELLED_PATTERN = new RegExp(
  BROWSER_QA_NAVIGATION_CANCELLED_PATTERN_SOURCE,
  BROWSER_QA_NAVIGATION_CANCELLED_PATTERN_FLAGS,
);

export function classifyBrowserQaRequestFailure(reason: string): string | undefined {
  return BROWSER_QA_NAVIGATION_CANCELLED_PATTERN.test(reason) ? 'navigation-cancelled' : undefined;
}

type BrowserQaWorkerResult = {
  title?: string;
  consoleErrors: string[];
  networkFailures: Array<{ url: string; status?: number }>;
  ignoredNetworkFailures?: Array<{ url: string; reason: string; classification: string }>;
  screenshots: Array<{ path: string; label: string; viewportName: string }>;
  traces: Array<{ path: string; label: string; viewportName: string }>;
  handoffs: Array<{ path: string; label: string; viewportName: string }>;
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
      const scriptInput: Record<string, unknown> = {
        targetUrl: input.request.targetUrl,
        screenshotPath: input.screenshotPath,
        tracePath: input.tracePath,
        handoffPath: input.handoffPath,
        outputPath,
        viewports: input.request.viewports,
      };
      // gstack P1: Inject auth session profile for authenticated Browser QA
      if (input.request.authSession) {
        scriptInput.authSession = {
          testAccountRef: input.request.authSession.testAccountRef,
          authMode: input.request.authSession.authMode ?? 'cookie',
          sessionToken: input.request.authSession.sessionToken,
          cookies: input.request.authSession.cookies,
          extraHeaders: input.request.authSession.extraHeaders,
        };
      }
      await execFileAsync('pnpm', ['--filter', '@repo/web', 'exec', 'node', '-e', this.script()], {
        cwd,
        env: {
          ...process.env,
          LOOPS_BROWSER_QA_INPUT: JSON.stringify(scriptInput),
        },
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 8,
      });
      const result = this.parseWorkerResult(await fs.readFile(outputPath, 'utf8'));
      const visualDiffs = await this.buildVisualDiffs({
        request: input.request,
        screenshots: result.screenshots,
        baselinePath: input.baselinePath,
        baselineRef: input.baselineRef,
        diffPath: input.diffPath,
        diffRef: input.diffRef,
        screenshotRef: input.screenshotRef,
      });
      const status =
        result.consoleErrors.length > 0 || result.networkFailures.length > 0 ? 'failed' : 'passed';
      return {
        id: input.reportId,
        issueId: input.issueId,
        runner: 'playwright-cli',
        status,
        targetUrl: input.request.targetUrl,
        title: result.title,
        screenshots: result.screenshots.map((item) => ({
          path: this.refForViewport(input.screenshotRef, item.viewportName),
          label: item.label,
        })),
        traces: result.traces.map((item) => ({
          path: this.refForViewport(input.traceRef, item.viewportName),
          label: item.label,
        })),
        visualDiffs,
        handoffs: result.handoffs.map((item) => ({
          path: this.refForViewport(input.handoffRef, item.viewportName),
          label: item.label,
        })),
        consoleErrors: result.consoleErrors,
        networkFailures: result.networkFailures,
        ignoredNetworkFailures: result.ignoredNetworkFailures,
        checkedFlows: input.request.checkedFlows,
        viewports: input.request.viewports,
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

  private parseWorkerResult(content: string): BrowserQaWorkerResult {
    const parsed = JSON.parse(content) as Partial<BrowserQaWorkerResult>;
    const consoleErrors = this.requiredWorkerArray(parsed, 'consoleErrors');
    const networkFailures = this.requiredWorkerArray(parsed, 'networkFailures');
    const screenshots = this.requiredWorkerArray(parsed, 'screenshots');
    const traces = this.requiredWorkerArray(parsed, 'traces');
    const handoffs = this.requiredWorkerArray(parsed, 'handoffs');
    return {
      title: parsed.title,
      consoleErrors,
      networkFailures,
      ignoredNetworkFailures: Array.isArray(parsed.ignoredNetworkFailures)
        ? parsed.ignoredNetworkFailures
        : undefined,
      screenshots,
      traces,
      handoffs,
    };
  }

  private requiredWorkerArray<K extends keyof BrowserQaWorkerResult>(
    parsed: Partial<BrowserQaWorkerResult>,
    key: K,
  ): Extract<BrowserQaWorkerResult[K], unknown[]> {
    const value = parsed[key];
    if (!Array.isArray(value)) {
      throw new Error(`Browser QA worker output is malformed: ${String(key)} must be an array.`);
    }
    return value as Extract<BrowserQaWorkerResult[K], unknown[]>;
  }

  private truncate(value: string): string {
    if (value.length <= OUTPUT_LIMIT) return value;
    return `${value.slice(0, OUTPUT_LIMIT)}\n[truncated ${value.length - OUTPUT_LIMIT} chars]`;
  }

  private async buildVisualDiffs(input: {
    request: LoopBrowserQaRequest;
    screenshots: BrowserQaWorkerResult['screenshots'];
    baselinePath: string;
    baselineRef: string;
    diffPath: string;
    diffRef: string;
    screenshotRef: string;
  }): Promise<NonNullable<LoopBrowserQaReport['visualDiffs']>> {
    const actuals = await Promise.all(
      input.screenshots.map(async (shot) => {
        const viewport =
          input.request.viewports.find((item) => item.name === shot.viewportName) ??
          input.request.viewports[0]!;
        return {
          path: shot.path,
          label: shot.label,
          viewport,
          data: await fs.readFile(shot.path),
        };
      }),
    );
    const baselines = (
      await Promise.all(
        actuals.map(async (actual) => {
          const baselinePath = this.pathForViewport(input.baselinePath, actual.viewport.name);
          try {
            return {
              path: baselinePath,
              label: actual.label,
              viewport: actual.viewport,
              data: await fs.readFile(baselinePath),
            };
          } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
            return undefined;
          }
        }),
      )
    ).filter((item): item is NonNullable<typeof item> => Boolean(item));

    const results = runVisualRegression({
      baselines,
      actuals,
      config: { defaultThreshold: 0, routeOverrides: {} },
      diffPathFn: (_baseline, actual) =>
        this.pathForViewport(input.diffPath, this.viewportNameFromPath(actual)),
    });

    await Promise.all(
      results.map(async (result) => {
        const actual = actuals.find((item) => item.label === result.label);
        if (!actual) return;
        if (result.status === 'baseline-created') {
          const baselinePath = this.pathForViewport(input.baselinePath, result.viewport.name);
          await fs.mkdir(path.dirname(baselinePath), { recursive: true });
          await fs.copyFile(actual.path, baselinePath);
        }
        if (result.status === 'changed' && result.diffPath) {
          await fs.mkdir(path.dirname(result.diffPath), { recursive: true });
          await fs.copyFile(actual.path, result.diffPath);
        }
      }),
    );

    return results.map((result) => ({
      baselinePath: this.refForViewport(input.baselineRef, result.viewport.name),
      actualPath: this.refForViewport(input.screenshotRef, result.viewport.name),
      diffPath:
        result.status === 'changed' && result.diffPath
          ? this.refForViewport(input.diffRef, result.viewport.name)
          : undefined,
      status: result.status === 'failed' ? 'changed' : result.status,
      changedPixels: result.changedPixels,
      label: result.label,
      viewport: result.viewport,
    }));
  }

  private pathForViewport(filePath: string, viewportName: string): string {
    const parsed = path.parse(filePath);
    return path.join(
      parsed.dir,
      `${parsed.name}-${this.safeViewportName(viewportName)}${parsed.ext}`,
    );
  }

  private refForViewport(ref: string, viewportName: string): string {
    const parsed = path.parse(ref);
    return `${parsed.dir}/${parsed.name}-${this.safeViewportName(viewportName)}${parsed.ext}`;
  }

  private safeViewportName(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || 'viewport';
  }

  private viewportNameFromPath(filePath: string): string {
    const name = path.parse(filePath).name;
    const match = name.match(/-([a-zA-Z0-9_-]+)$/);
    return match?.[1] ?? 'viewport';
  }

  private script(): string {
    return `
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function safeViewportName(value) {
  return String(value || 'viewport').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || 'viewport';
}

function pathForViewport(filePath, viewportName) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, parsed.name + '-' + safeViewportName(viewportName) + parsed.ext);
}

(async () => {
  const input = JSON.parse(process.env.LOOPS_BROWSER_QA_INPUT || '{}');
  const viewports = Array.isArray(input.viewports) && input.viewports.length > 0
    ? input.viewports
    : [{ name: 'desktop', width: 1440, height: 900 }];
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const networkFailures = [];
  const ignoredNetworkFailures = [];
  const screenshots = [];
  const traces = [];
  const handoffs = [];
  let title;
  for (const viewport of viewports) {
    const viewportName = safeViewportName(viewport.name);
    const screenshotPath = pathForViewport(input.screenshotPath, viewportName);

function buildContextOptions(viewport, authSession) {
  var opts = { viewport: { width: viewport.width, height: viewport.height } };
  if (!authSession) return opts;
  if (authSession.authMode === 'cookie' && authSession.cookies && authSession.cookies.length) {
    opts.storageState = { cookies: authSession.cookies.map(function(c) { return { name: c.name, value: c.value, domain: c.domain, path: c.path || '/', httpOnly: c.httpOnly || false, secure: c.secure !== false, sameSite: c.sameSite || 'Lax' }; }), origins: [] };
  }
  if (authSession.extraHeaders || authSession.authMode === 'token') {
    opts.extraHTTPHeaders = opts.extraHTTPHeaders || {};
    if (authSession.extraHeaders) Object.assign(opts.extraHTTPHeaders, authSession.extraHeaders);
    if (authSession.authMode === 'token' && authSession.sessionToken) opts.extraHTTPHeaders['Authorization'] = 'Bearer ' + authSession.sessionToken;
  }
  return opts;
}

    const tracePath = pathForViewport(input.tracePath, viewportName);
    const handoffPath = pathForViewport(input.handoffPath, viewportName);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.mkdirSync(path.dirname(tracePath), { recursive: true });
    fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
	    const contextOpts = buildContextOptions(viewport, input.authSession);
	    const context = await browser.newContext(contextOpts);
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkFailures.push({ url: response.url(), status: response.status() });
      }
    });
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      const reason = failure && failure.errorText ? failure.errorText : 'request failed';
      if (new RegExp(${JSON.stringify(BROWSER_QA_NAVIGATION_CANCELLED_PATTERN_SOURCE)}, ${JSON.stringify(
        BROWSER_QA_NAVIGATION_CANCELLED_PATTERN_FLAGS,
      )}).test(reason)) {
        ignoredNetworkFailures.push({
          url: request.url(),
          reason,
          classification: 'navigation-cancelled',
        });
        return;
      }
      networkFailures.push({ url: request.url() });
    });
    await page.goto(input.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    title = title || await page.title();
    await context.tracing.stop({ path: tracePath });
    await context.close();
    screenshots.push({
      path: screenshotPath,
      label: 'page-load · ' + viewportName + ' ' + viewport.width + 'x' + viewport.height,
      viewportName,
    });
    traces.push({
      path: tracePath,
      label: 'page-load · ' + viewportName,
      viewportName,
    });
    fs.writeFileSync(handoffPath, JSON.stringify({
      targetUrl: input.targetUrl,
      title,
      screenshotPath,
      tracePath,
      viewport,
      consoleErrors,
      networkFailures,
      ignoredNetworkFailures,
      created: new Date().toISOString(),
    }, null, 2));
    handoffs.push({
      path: handoffPath,
      label: 'playwright-context · ' + viewportName,
      viewportName,
    });
  }
  await browser.close();
  fs.writeFileSync(input.outputPath, JSON.stringify({
    title,
    consoleErrors,
    networkFailures,
    ignoredNetworkFailures,
    screenshots,
    traces,
    handoffs,
  }));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
`;
  }
}
