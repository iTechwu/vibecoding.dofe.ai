/**
 * Deterministic simple-issue normalisation (0622 · B4 / B5).
 *
 * Pure functions shared by the backend (`createSimpleIssue`) and the frontend
 * (live preview on `/loops/new`) so the two never drift. No LLM is involved in
 * v1 — title/template/priority/criteria are derived from keyword rules and the
 * request text, mirroring docs/0622/agent-run-time/03-simple-issue-intake.md.
 *
 * The backend remains authoritative: it runs these same functions and persists
 * the result. The frontend preview is advisory and every field is overridable
 * via the advanced settings.
 */
import type { LoopPriority, LoopSimpleIssueTemplate } from './schemas/loops.schema';

/** A `template: 'auto'` value resolved into a concrete template id. */
export type ResolvedLoopIssueTemplate = Exclude<LoopSimpleIssueTemplate, 'auto'>;

const DEFAULT_PRIORITY_BY_TEMPLATE: Record<ResolvedLoopIssueTemplate, LoopPriority> = {
  feature: 'P1',
  bugfix: 'P0',
  docs: 'P3',
  refactor: 'P2',
  integration: 'P1',
  flow: 'P1',
};

const TEMPLATE_KEYWORDS: Array<{ template: ResolvedLoopIssueTemplate; terms: string[] }> = [
  { template: 'bugfix', terms: ['修复', 'bug', '异常', '失败', '报错', 'fix', 'broken', 'crash'] },
  { template: 'docs', terms: ['文档', '说明', '方案', 'adr', 'docs', 'document', 'readme'] },
  {
    template: 'refactor',
    terms: ['重构', '简化', '清理', 'refactor', 'cleanup', 'simplify'],
  },
  {
    template: 'integration',
    terms: ['接入', '集成', 'docker', 'cli', '外部服务', 'integrate', 'external'],
  },
  {
    template: 'flow',
    terms: ['workflow', '状态机', '恢复', 'agent runtime', 'flow', 'state machine', 'resume'],
  },
];

const TITLE_PREFIX_PATTERN =
  /^(请|帮我|麻烦|需要|我想要|想要|希望|please|help me|i need|i want|can you)\s*/i;

/**
 * Default acceptance-criteria drafts per template. Mirrors the i18n template
 * criteria so the simple-mode draft matches the full-form templates. Backend
 * returns these when the caller supplies no explicit criteria; the detail page
 * shows them and advanced users can edit.
 */
export const DEFAULT_SIMPLE_ACCEPTANCE_CRITERIA: Record<ResolvedLoopIssueTemplate, string[]> = {
  bugfix: [
    'Root cause is identified and described in the implementation evidence',
    'The reproduction path now passes',
    'A regression test covers the fixed behavior',
    'No unrelated behavior is changed',
  ],
  feature: [
    'Primary happy path is implemented end to end',
    'User-facing states cover loading, success, and error outcomes',
    'Backend/API contract is validated with tests when data changes are involved',
    'Frontend page is understandable and operable',
  ],
  docs: [
    'Documentation matches the current implementation',
    'Status labels clearly distinguish done, accepted, planned, and blocked work',
    'Commands or examples are accurate and runnable where applicable',
    'Any deferred work includes the reason and required next input',
  ],
  refactor: [
    'External behavior and public contracts remain compatible',
    'Duplication or complexity is reduced in the target area',
    'Existing tests pass and focused coverage is added for touched shared behavior',
    'No unrelated formatting or metadata churn is introduced',
  ],
  integration: [
    'A clear fallback exists when the local dependency is missing',
    'External failures surface actionable diagnostics',
    'Sensitive values never reach operational logs',
    'Smoke checks cover both success and failure paths',
  ],
  flow: [
    'State transitions cover success, pause, failure, and resume',
    'Human-in-the-loop intervention points are clearly visible',
    'Runtime status and diagnostics are traceable',
    'Resume behavior is recorded with evidence',
  ],
};

/** Resolve `template: 'auto'` from request keywords (defaults to `feature`). */
export function inferLoopIssueTemplate(request: string): ResolvedLoopIssueTemplate {
  const haystack = request.toLowerCase();
  for (const { template, terms } of TEMPLATE_KEYWORDS) {
    if (terms.some((term) => haystack.includes(term.toLowerCase()))) {
      return template;
    }
  }
  return 'feature';
}

/** Build a deterministic title from the request: first line/sentence, trimmed and truncated. */
export function buildLoopIssueTitle(request: string, template: ResolvedLoopIssueTemplate): string {
  const firstLine = request.trim().split(/\r?\n/)[0] ?? '';
  // First sentence (up to a period/Chinese full stop) or the whole first line.
  const sentenceMatch = firstLine.match(/^(.*?[。.!?！？])/);
  let base = (sentenceMatch?.[1] ?? firstLine).trim();
  base = base.replace(TITLE_PREFIX_PATTERN, '').trim();
  // Strip trailing sentence terminators / whitespace so titles stay clean.
  base = base.replace(/[。.!?！？\s]+$/, '').trim();

  const verbByTemplate: Record<ResolvedLoopIssueTemplate, string> = {
    bugfix: 'Fix',
    feature: 'Add',
    docs: 'Document',
    refactor: 'Refactor',
    integration: 'Integrate',
    flow: 'Model',
  };
  const verb = verbByTemplate[template];

  // Only prepend an English verb when the title is ASCII (avoids "Fix 帮我...").
  const looksAscii = /^[\x00-\x7F]+$/.test(base);
  const titled = base.length === 0 ? request.trim().slice(0, 80) : base;
  const withVerb =
    looksAscii && !/^fix|^add|^document|^refactor|^integrate/i.test(titled)
      ? `${verb} ${titled}`
      : titled;

  return withVerb.length > 80 ? `${withVerb.slice(0, 77).trimEnd()}...` : withVerb;
}

export interface NormaliseSimpleIssueInput {
  request: string;
  template: LoopSimpleIssueTemplate;
  /** Caller-provided overrides (from advanced settings). */
  title?: string;
  priority?: LoopPriority;
  acceptanceCriteria?: string[];
  targetRepo: string;
}

export interface NormalisedSimpleIssue {
  title: string;
  body: string;
  template: ResolvedLoopIssueTemplate;
  priority: LoopPriority;
  acceptanceCriteria: string[];
  targetRepo: string;
}

/**
 * Normalise a simple issue request into the full issue shape.
 *
 * - `template: 'auto'` is resolved via keyword inference.
 * - Missing title → deterministic title from the request text.
 * - Missing priority → the template's default priority.
 * - Missing criteria → the template's default acceptance draft.
 * - `body` always preserves the user's original request verbatim (the detail
 *   page shows it so intent is never lost).
 */
export function normaliseSimpleIssue(input: NormaliseSimpleIssueInput): NormalisedSimpleIssue {
  const template =
    input.template === 'auto' ? inferLoopIssueTemplate(input.request) : input.template;
  const title = input.title?.trim() || buildLoopIssueTitle(input.request, template);
  const priority = input.priority ?? DEFAULT_PRIORITY_BY_TEMPLATE[template];
  const acceptanceCriteria =
    input.acceptanceCriteria && input.acceptanceCriteria.length > 0
      ? input.acceptanceCriteria
      : DEFAULT_SIMPLE_ACCEPTANCE_CRITERIA[template];

  return {
    title,
    body: input.request.trim(),
    template,
    priority,
    acceptanceCriteria,
    targetRepo: input.targetRepo,
  };
}
