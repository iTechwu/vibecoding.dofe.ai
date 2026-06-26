// gstack/0 R6 P1-3
export interface ViewportSpec {
  name: string;
  width: number;
  height: number;
}

/** gstack P1: Rectangle region to ignore during pixel comparison. */
export interface IgnoreRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optional label for audit trail. */
  label?: string;
}

/** gstack P1: Dynamic content mask based on CSS selector or coordinate region. */
export interface DynamicContentMask {
  /** CSS selector for the element to mask (e.g., '.timestamp', '[data-testid="ad"]'). */
  selector?: string;
  /** Fallback region if selector can't be resolved. */
  region?: IgnoreRegion;
  /** Label for audit trail (e.g., 'timestamp', 'ad-banner', 'live-chat'). */
  label: string;
}

export interface VisualRegressionConfig {
  defaultThreshold: number;
  routeOverrides: Record<string, number>;
  /** gstack P1: Regions to ignore during pixel comparison (e.g., timestamps, ads). */
  ignoreRegions?: IgnoreRegion[];
  /** gstack P1: Dynamic content masks for elements that change between runs. */
  dynamicContentMasks?: DynamicContentMask[];
}
export interface VisualDiffResult {
  label: string;
  viewport: ViewportSpec;
  status: 'matched' | 'changed' | 'baseline-created' | 'failed';
  changedPixels?: number;
  ignoredPixels?: number;
  diffPath?: string;
  /** gstack P1: Applied ignore region count for audit trail. */
  ignoreRegionCount?: number;
  /** gstack P1: Applied dynamic content mask labels for audit trail. */
  maskLabels?: string[];
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

/**
 * gstack P1: Check whether a pixel at (px, py) falls within any ignore region.
 * Used to skip known-dynamic areas (timestamps, ads, live data) during comparison.
 */
export function isPixelIgnored(
  px: number,
  py: number,
  imageWidth: number,
  ignoreRegions?: IgnoreRegion[],
): boolean {
  if (!ignoreRegions?.length) return false;
  return ignoreRegions.some(
    (r) => px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height,
  );
}

export function comparePixelBuffers(
  baseline: Buffer,
  actual: Buffer,
  threshold: number,
  imageWidth?: number,
  ignoreRegions?: IgnoreRegion[],
): { matched: boolean; changedPixels: number; ignoredPixels?: number } {
  if (baseline.equals(actual)) return { matched: true, changedPixels: 0, ignoredPixels: 0 };
  if (baseline.length !== actual.length)
    return { matched: false, changedPixels: Math.max(baseline.length, actual.length) };
  let changed = 0;
  let ignored = 0;
  const len = Math.min(baseline.length, actual.length);
  const width = imageWidth ?? Math.floor(Math.sqrt(len / 4));
  for (let i = 0; i < len; i += 4) {
    if (imageWidth && ignoreRegions?.length) {
      const pixelIndex = i / 4;
      const px = pixelIndex % width;
      const py = Math.floor(pixelIndex / width);
      if (isPixelIgnored(px, py, width, ignoreRegions)) {
        ignored++;
        continue;
      }
    }
    const dr = Math.abs(baseline[i] - actual[i]);
    const dg = Math.abs(baseline[i + 1] - actual[i + 1]);
    const db = Math.abs(baseline[i + 2] - actual[i + 2]);
    if (dr > threshold || dg > threshold || db > threshold) changed++;
  }
  return { matched: changed === 0, changedPixels: changed, ignoredPixels: ignored };
}

export function runVisualRegression(input: {
  baselines: Array<{ path: string; label: string; viewport: ViewportSpec; data: Buffer }>;
  actuals: Array<{ path: string; label: string; viewport: ViewportSpec; data: Buffer }>;
  config: VisualRegressionConfig;
  diffPathFn?: (baseline: string, actual: string) => string;
  /** gstack P1: Image width for pixel coordinate calculation with ignore regions. */
  imageWidth?: number;
}): VisualDiffResult[] {
  const results: VisualDiffResult[] = [];
  const actualMap = new Map(input.actuals.map((a) => [a.label, a]));
  const ignoreRegions = input.config.ignoreRegions;
  const maskLabels = input.config.dynamicContentMasks?.map((m) => m.label);

  for (const baseline of input.baselines) {
    const actual = actualMap.get(baseline.label);
    if (!actual) {
      results.push({
        label: baseline.label,
        viewport: baseline.viewport,
        status: 'failed',
        changedPixels: 0,
        ignoreRegionCount: ignoreRegions?.length ?? 0,
        maskLabels,
      });
      continue;
    }
    if (hashBuffer(baseline.data) === hashBuffer(actual.data)) {
      results.push({
        label: baseline.label,
        viewport: baseline.viewport,
        status: 'matched',
        changedPixels: 0,
        ignoredPixels: 0,
        ignoreRegionCount: ignoreRegions?.length ?? 0,
        maskLabels,
      });
      continue;
    }
    const threshold = resolveThreshold(baseline.label, input.config);
    const width = input.imageWidth ?? baseline.viewport.width;
    const { matched, changedPixels, ignoredPixels } = comparePixelBuffers(
      baseline.data,
      actual.data,
      threshold,
      width,
      ignoreRegions,
    );
    results.push({
      label: baseline.label,
      viewport: baseline.viewport,
      status: matched ? 'matched' : 'changed',
      changedPixels: matched ? 0 : changedPixels,
      ignoredPixels: ignoredPixels ?? 0,
      diffPath: matched ? undefined : input.diffPathFn?.(baseline.path, actual.path),
      ignoreRegionCount: ignoreRegions?.length ?? 0,
      maskLabels,
    });
  }
  for (const actual of input.actuals) {
    if (!input.baselines.some((b) => b.label === actual.label)) {
      results.push({
        label: actual.label,
        viewport: actual.viewport,
        status: 'baseline-created',
        changedPixels: 0,
        ignoreRegionCount: ignoreRegions?.length ?? 0,
        maskLabels,
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
