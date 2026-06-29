import { execFile } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import {
  classifyBrowserQaRequestFailure,
  LoopsBrowserQaWorkerService,
} from './loops-browser-qa-worker.service';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

const mockedExecFile = execFile as unknown as jest.Mock;

describe('classifyBrowserQaRequestFailure', () => {
  it('classifies common browser navigation cancellations as ignored noise', () => {
    for (const reason of [
      'net::ERR_ABORTED',
      'AbortError: The operation was aborted',
      'NS_BINDING_ABORTED',
      'Request cancelled',
      'request canceled',
    ]) {
      expect(classifyBrowserQaRequestFailure(reason)).toBe('navigation-cancelled');
    }
  });

  it('does not ignore real request failures', () => {
    expect(classifyBrowserQaRequestFailure('net::ERR_CONNECTION_REFUSED')).toBeUndefined();
    expect(classifyBrowserQaRequestFailure('net::ERR_NAME_NOT_RESOLVED')).toBeUndefined();
  });
});

describe('LoopsBrowserQaWorkerService', () => {
  let dir: string;
  let previousAllowedRoots: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loops-browser-qa-'));
    previousAllowedRoots = process.env.LOOPS_ALLOWED_REPO_ROOTS;
    process.env.LOOPS_ALLOWED_REPO_ROOTS = dir;
    mockedExecFile.mockReset();
  });

  afterEach(async () => {
    if (previousAllowedRoots === undefined) {
      delete process.env.LOOPS_ALLOWED_REPO_ROOTS;
    } else {
      process.env.LOOPS_ALLOWED_REPO_ROOTS = previousAllowedRoots;
    }
    await rm(dir, { recursive: true, force: true });
  });

  it('builds per-viewport visual regression artifacts with changed pixel evidence', async () => {
    const service = new LoopsBrowserQaWorkerService();
    const artifact = (name: string) => path.join(dir, name);
    const baselineDesktop = artifact('baseline-desktop.png');
    const baselineMobile = artifact('baseline-mobile.png');
    await writeFile(baselineDesktop, Buffer.from([0, 0, 0, 255, 10, 10, 10, 255]));
    await writeFile(baselineMobile, Buffer.from([1, 1, 1, 255]));

    mockedExecFile.mockImplementation(
      (
        _command: string,
        _args: string[],
        options: { env?: Record<string, string | undefined> },
        callback: (error: Error | null, stdout?: string, stderr?: string) => void,
      ) => {
        const input = JSON.parse(options.env?.LOOPS_BROWSER_QA_INPUT ?? '{}') as {
          screenshotPath: string;
          tracePath: string;
          handoffPath: string;
          outputPath: string;
        };
        const screenshotDesktop = artifact('screenshot-desktop.png');
        const screenshotMobile = artifact('screenshot-mobile.png');
        const traceDesktop = artifact('trace-desktop.zip');
        const traceMobile = artifact('trace-mobile.zip');
        const handoffDesktop = artifact('handoff-desktop.json');
        const handoffMobile = artifact('handoff-mobile.json');

        expect(input.screenshotPath).toBe(artifact('screenshot.png'));
        Promise.all([
          writeFile(screenshotDesktop, Buffer.from([0, 0, 0, 255, 20, 10, 10, 255])),
          writeFile(screenshotMobile, Buffer.from([1, 1, 1, 255])),
          writeFile(traceDesktop, Buffer.from('trace-desktop')),
          writeFile(traceMobile, Buffer.from('trace-mobile')),
          writeFile(handoffDesktop, JSON.stringify({ viewport: 'desktop' })),
          writeFile(handoffMobile, JSON.stringify({ viewport: 'mobile' })),
          writeFile(
            input.outputPath,
            JSON.stringify({
              title: 'QA target',
              consoleErrors: [],
              networkFailures: [],
              screenshots: [
                {
                  path: screenshotDesktop,
                  label: 'page-load · desktop 1440x900',
                  viewportName: 'desktop',
                },
                {
                  path: screenshotMobile,
                  label: 'page-load · mobile 375x812',
                  viewportName: 'mobile',
                },
              ],
              traces: [
                { path: traceDesktop, label: 'page-load · desktop', viewportName: 'desktop' },
                { path: traceMobile, label: 'page-load · mobile', viewportName: 'mobile' },
              ],
              handoffs: [
                {
                  path: handoffDesktop,
                  label: 'playwright-context · desktop',
                  viewportName: 'desktop',
                },
                {
                  path: handoffMobile,
                  label: 'playwright-context · mobile',
                  viewportName: 'mobile',
                },
              ],
            }),
          ),
        ])
          .then(() => callback(null, '', ''))
          .catch((error) => callback(error as Error));
      },
    );

    const report = await service.run({
      issueId: 'issue-1',
      reportId: 'browser-qa-1',
      targetRepo: dir,
      request: {
        targetUrl: 'https://example.com',
        checkedFlows: ['page-load'],
        viewports: [
          { name: 'desktop', width: 1440, height: 900 },
          { name: 'mobile', width: 375, height: 812 },
        ],
      },
      screenshotPath: artifact('screenshot.png'),
      screenshotRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/screenshot.png',
      tracePath: artifact('trace.zip'),
      traceRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/trace.zip',
      baselinePath: artifact('baseline.png'),
      baselineRef: '.loops/runs/issue-1/browser-qa/baseline.png',
      diffPath: artifact('visual-diff.png'),
      diffRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/visual-diff.png',
      handoffPath: artifact('handoff.json'),
      handoffRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/handoff.json',
      createdAt: '2026-06-24T00:00:00.000Z',
    });

    expect(report).toMatchObject({
      status: 'passed',
      screenshots: [
        {
          path: expect.stringContaining('screenshot-desktop.png'),
          label: 'page-load · desktop 1440x900',
        },
        {
          path: expect.stringContaining('screenshot-mobile.png'),
          label: 'page-load · mobile 375x812',
        },
      ],
      traces: [
        { path: expect.stringContaining('trace-desktop.zip') },
        { path: expect.stringContaining('trace-mobile.zip') },
      ],
      handoffs: [
        { path: expect.stringContaining('handoff-desktop.json') },
        { path: expect.stringContaining('handoff-mobile.json') },
      ],
    });
    expect(report.visualDiffs).toEqual([
      expect.objectContaining({
        status: 'changed',
        changedPixels: 1,
        diffPath: expect.stringContaining('visual-diff-desktop.png'),
        viewport: { name: 'desktop', width: 1440, height: 900 },
      }),
      expect.objectContaining({
        status: 'matched',
        changedPixels: 0,
        diffPath: undefined,
        viewport: { name: 'mobile', width: 375, height: 812 },
      }),
    ]);
    await expect(readFile(artifact('visual-diff-desktop.png'))).resolves.toEqual(
      Buffer.from([0, 0, 0, 255, 20, 10, 10, 255]),
    );
  });

  it('keeps expected navigation aborts out of Browser QA failure status', async () => {
    const service = new LoopsBrowserQaWorkerService();
    const artifact = (name: string) => path.join(dir, name);

    mockedExecFile.mockImplementation(
      (
        _command: string,
        _args: string[],
        options: { env?: Record<string, string | undefined> },
        callback: (error: Error | null, stdout?: string, stderr?: string) => void,
      ) => {
        const input = JSON.parse(options.env?.LOOPS_BROWSER_QA_INPUT ?? '{}') as {
          screenshotPath: string;
          tracePath: string;
          handoffPath: string;
          outputPath: string;
        };
        const screenshotDesktop = artifact('screenshot-desktop.png');
        const traceDesktop = artifact('trace-desktop.zip');
        const handoffDesktop = artifact('handoff-desktop.json');

        Promise.all([
          writeFile(screenshotDesktop, Buffer.from([1, 1, 1, 255])),
          writeFile(traceDesktop, Buffer.from('trace')),
          writeFile(handoffDesktop, JSON.stringify({ viewport: 'desktop' })),
          writeFile(
            input.outputPath,
            JSON.stringify({
              title: 'QA target',
              consoleErrors: [],
              networkFailures: [],
              ignoredNetworkFailures: [
                {
                  url: 'https://example.com/_next/static/chunk.css',
                  reason: 'net::ERR_ABORTED',
                  classification: 'navigation-cancelled',
                },
              ],
              screenshots: [
                {
                  path: screenshotDesktop,
                  label: 'page-load · desktop 1440x900',
                  viewportName: 'desktop',
                },
              ],
              traces: [
                { path: traceDesktop, label: 'page-load · desktop', viewportName: 'desktop' },
              ],
              handoffs: [
                {
                  path: handoffDesktop,
                  label: 'playwright-context · desktop',
                  viewportName: 'desktop',
                },
              ],
            }),
          ),
        ])
          .then(() => callback(null, '', ''))
          .catch((error) => callback(error as Error));
      },
    );

    const report = await service.run({
      issueId: 'issue-1',
      reportId: 'browser-qa-1',
      targetRepo: dir,
      request: {
        targetUrl: 'https://example.com',
        checkedFlows: ['page-load'],
        viewports: [{ name: 'desktop', width: 1440, height: 900 }],
      },
      screenshotPath: artifact('screenshot.png'),
      screenshotRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/screenshot.png',
      tracePath: artifact('trace.zip'),
      traceRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/trace.zip',
      baselinePath: artifact('baseline.png'),
      baselineRef: '.loops/runs/issue-1/browser-qa/baseline.png',
      diffPath: artifact('visual-diff.png'),
      diffRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/visual-diff.png',
      handoffPath: artifact('handoff.json'),
      handoffRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/handoff.json',
      createdAt: '2026-06-24T00:00:00.000Z',
    });

    expect(report.status).toBe('passed');
    expect(report.networkFailures).toEqual([]);
    expect(report.ignoredNetworkFailures).toEqual([
      {
        url: 'https://example.com/_next/static/chunk.css',
        reason: 'net::ERR_ABORTED',
        classification: 'navigation-cancelled',
      },
    ]);
  });

  it('blocks with a readable reason when worker output is malformed', async () => {
    const service = new LoopsBrowserQaWorkerService();
    const artifact = (name: string) => path.join(dir, name);

    mockedExecFile.mockImplementation(
      (
        _command: string,
        _args: string[],
        options: { env?: Record<string, string | undefined> },
        callback: (error: Error | null, stdout?: string, stderr?: string) => void,
      ) => {
        const input = JSON.parse(options.env?.LOOPS_BROWSER_QA_INPUT ?? '{}') as {
          outputPath: string;
        };
        writeFile(
          input.outputPath,
          JSON.stringify({
            title: 'Malformed QA target',
            consoleErrors: [],
            networkFailures: [],
          }),
        )
          .then(() => callback(null, '', ''))
          .catch((error) => callback(error as Error));
      },
    );

    const report = await service.run({
      issueId: 'issue-1',
      reportId: 'browser-qa-1',
      targetRepo: dir,
      request: {
        targetUrl: 'https://example.com',
        checkedFlows: ['page-load'],
        viewports: [{ name: 'desktop', width: 1440, height: 900 }],
      },
      screenshotPath: artifact('screenshot.png'),
      screenshotRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/screenshot.png',
      tracePath: artifact('trace.zip'),
      traceRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/trace.zip',
      baselinePath: artifact('baseline.png'),
      baselineRef: '.loops/runs/issue-1/browser-qa/baseline.png',
      diffPath: artifact('visual-diff.png'),
      diffRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/visual-diff.png',
      handoffPath: artifact('handoff.json'),
      handoffRef: '.loops/runs/issue-1/browser-qa/browser-qa-1/handoff.json',
      createdAt: '2026-06-24T00:00:00.000Z',
    });

    expect(report.status).toBe('blocked');
    expect(report.blockedReason).toContain('Browser QA worker output is malformed');
  });
});
