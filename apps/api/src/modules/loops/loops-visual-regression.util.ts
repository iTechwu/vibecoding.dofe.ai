// gstack/0 R6 P1-3
export interface ViewportSpec {
  name: string;
  width: number;
  height: number;
}
export interface VisualRegressionConfig {
  defaultThreshold: number;
  routeOverrides: Record<string, number>;
}
export interface VisualDiffResult {
  label: string;
  viewport: ViewportSpec;
  status: 'matched' | 'changed' | 'baseline-created' | 'failed';
  changedPixels?: number;
  diffPath?: string;
}
export interface VisualRegressionSummary {
  total: number;
  matched: number;
  changed: number;
  baselineCreated: number;
  failed: number;
}

export function buildDefaultViewports(): ViewportSpec[] {
  return [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
  ];
}

export function resolveThreshold(route: string, config: VisualRegressionConfig): number {
  for (const [pattern, threshold] of Object.entries(config.routeOverrides)) {
    if (new RegExp(pattern).test(route)) return threshold;
  }
  return config.defaultThreshold;
}

function hashBuffer(buf: Buffer): string {
  let hash = 0;
  for (let i = 0; i < Math.min(buf.length, 4096); i++) {
    hash = (hash << 5) - hash + buf[i];
    hash |= 0;
  }
  return hash.toString(16);
}

export function comparePixelBuffers(
  baseline: Buffer,
  actual: Buffer,
  threshold: number,
): { matched: boolean; changedPixels: number } {
  if (baseline.equals(actual)) return { matched: true, changedPixels: 0 };
  if (baseline.length !== actual.length)
    return { matched: false, changedPixels: Math.max(baseline.length, actual.length) };
  let changed = 0;
  const len = Math.min(baseline.length, actual.length);
  for (let i = 0; i < len; i += 4) {
    const dr = Math.abs(baseline[i] - actual[i]);
    const dg = Math.abs(baseline[i + 1] - actual[i + 1]);
    const db = Math.abs(baseline[i + 2] - actual[i + 2]);
    if (dr > threshold || dg > threshold || db > threshold) changed++;
  }
  return { matched: changed === 0, changedPixels: changed };
}

export function runVisualRegression(input: {
  baselines: Array<{ path: string; label: string; viewport: ViewportSpec; data: Buffer }>;
  actuals: Array<{ path: string; label: string; viewport: ViewportSpec; data: Buffer }>;
  config: VisualRegressionConfig;
  diffPathFn?: (baseline: string, actual: string) => string;
}): VisualDiffResult[] {
  const results: VisualDiffResult[] = [];
  const actualMap = new Map(input.actuals.map((a) => [a.label, a]));

  for (const baseline of input.baselines) {
    const actual = actualMap.get(baseline.label);
    if (!actual) {
      results.push({
        label: baseline.label,
        viewport: baseline.viewport,
        status: 'failed',
        changedPixels: 0,
      });
      continue;
    }
    if (hashBuffer(baseline.data) === hashBuffer(actual.data)) {
      results.push({
        label: baseline.label,
        viewport: baseline.viewport,
        status: 'matched',
        changedPixels: 0,
      });
      continue;
    }
    const threshold = resolveThreshold(baseline.label, input.config);
    const { matched, changedPixels } = comparePixelBuffers(baseline.data, actual.data, threshold);
    results.push({
      label: baseline.label,
      viewport: baseline.viewport,
      status: matched ? 'matched' : 'changed',
      changedPixels: matched ? 0 : changedPixels,
      diffPath: matched ? undefined : input.diffPathFn?.(baseline.path, actual.path),
    });
  }
  for (const actual of input.actuals) {
    if (!input.baselines.some((b) => b.label === actual.label)) {
      results.push({
        label: actual.label,
        viewport: actual.viewport,
        status: 'baseline-created',
        changedPixels: 0,
      });
    }
  }
  return results;
}

export function summarizeResults(results: VisualDiffResult[]): VisualRegressionSummary {
  return {
    total: results.length,
    matched: results.filter((r) => r.status === 'matched').length,
    changed: results.filter((r) => r.status === 'changed').length,
    baselineCreated: results.filter((r) => r.status === 'baseline-created').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };
}
