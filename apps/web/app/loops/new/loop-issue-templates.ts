export type LoopIssueTemplateId =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'docs'
  | 'integration'
  | 'flow';

export interface WorkforcePersonaEntry {
  id: string;
  label: string;
}

export interface EvalCheckEntry {
  id: string;
  label: string;
  hardGate: boolean;
}

export interface GateEntry {
  id: string;
  label: string;
  kind: 'human' | 'agent' | 'release';
}

export interface LoopIssueTemplate {
  id: LoopIssueTemplateId;
  translationKey: `templates.${LoopIssueTemplateId}`;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  agentPathKey: `simple.agentPath.${LoopIssueTemplateId}`;
  testPolicyKey: `simple.testPolicy.${LoopIssueTemplateId}`;
  /** P1-1 Invent Delivery Loop: persona sequence for workforce plan preview */
  workforceSequence: WorkforcePersonaEntry[];
  primaryRuntime: string;
  secondaryRuntime: string;
  evalChecks: EvalCheckEntry[];
  gates: GateEntry[];
}

const FEATURE_PERSONAS: WorkforcePersonaEntry[] = [
  { id: 'intake-analyst', label: 'Intake Analyst' },
  { id: 'spec-writer', label: 'Spec Writer' },
  { id: 'human-gatekeeper', label: 'Human Gatekeeper' },
  { id: 'work-planner', label: 'Work Planner' },
  { id: 'builder', label: 'Builder' },
  { id: 'test-runner', label: 'Test Runner' },
  { id: 'code-reviewer', label: 'Code Reviewer' },
  { id: 'release-reviewer', label: 'Release Reviewer' },
  { id: 'evidence-curator', label: 'Evidence Curator' },
];

const BUGFIX_PERSONAS: WorkforcePersonaEntry[] = [
  { id: 'intake-analyst', label: 'Intake Analyst' },
  { id: 'builder', label: 'Builder' },
  { id: 'test-runner', label: 'Test Runner' },
  { id: 'code-reviewer', label: 'Code Reviewer' },
  { id: 'release-reviewer', label: 'Release Reviewer' },
  { id: 'evidence-curator', label: 'Evidence Curator' },
];

const DOCS_PERSONAS: WorkforcePersonaEntry[] = [
  { id: 'intake-analyst', label: 'Intake Analyst' },
  { id: 'spec-writer', label: 'Spec Writer' },
  { id: 'human-gatekeeper', label: 'Human Gatekeeper' },
  { id: 'evidence-curator', label: 'Evidence Curator' },
];

const EVAL_ALL: EvalCheckEntry[] = [
  { id: 'architecture-compliance', label: 'Architecture', hardGate: true },
  { id: 'delivery-readiness', label: 'Delivery', hardGate: true },
  { id: 'runtime-safety', label: 'Runtime safety', hardGate: true },
  { id: 'test-evidence', label: 'Test evidence', hardGate: true },
  { id: 'cost-policy', label: 'Cost policy', hardGate: true },
];

const EVAL_DOCS: EvalCheckEntry[] = [
  { id: 'delivery-readiness', label: 'Delivery', hardGate: true },
  { id: 'test-evidence', label: 'Test evidence', hardGate: false },
  { id: 'cost-policy', label: 'Cost policy', hardGate: false },
];

const GATES_STANDARD: GateEntry[] = [
  { id: 'spec-review', label: 'Spec review', kind: 'human' },
  { id: 'code-review', label: 'Code review', kind: 'agent' },
  { id: 'release-check', label: 'Release gate', kind: 'release' },
];

const GATES_BUGFIX: GateEntry[] = [
  { id: 'spec-review', label: 'Spec review', kind: 'human' },
  { id: 'regression-test', label: 'Regression test', kind: 'agent' },
  { id: 'code-review', label: 'Code review', kind: 'agent' },
  { id: 'release-check', label: 'Release gate', kind: 'release' },
];

const GATES_SECURITY: GateEntry[] = [
  { id: 'spec-review', label: 'Spec review', kind: 'human' },
  { id: 'security-review', label: 'Security review', kind: 'human' },
  { id: 'code-review', label: 'Code review', kind: 'agent' },
  { id: 'release-check', label: 'Release gate', kind: 'release' },
];

export const DEFAULT_LOOP_ISSUE_TEMPLATE: LoopIssueTemplate = {
  id: 'feature',
  translationKey: 'templates.feature',
  priority: 'P1',
  agentPathKey: 'simple.agentPath.feature',
  testPolicyKey: 'simple.testPolicy.feature',
  workforceSequence: FEATURE_PERSONAS,
  primaryRuntime: 'Codex CLI',
  secondaryRuntime: 'Claude Code CLI',
  evalChecks: EVAL_ALL,
  gates: GATES_STANDARD,
};

export const LOOP_ISSUE_TEMPLATES: LoopIssueTemplate[] = [
  DEFAULT_LOOP_ISSUE_TEMPLATE,
  {
    id: 'bugfix',
    translationKey: 'templates.bugfix',
    priority: 'P0',
    agentPathKey: 'simple.agentPath.bugfix',
    testPolicyKey: 'simple.testPolicy.bugfix',
    workforceSequence: BUGFIX_PERSONAS,
    primaryRuntime: 'Codex CLI',
    secondaryRuntime: 'Claude Code CLI',
    evalChecks: EVAL_ALL,
    gates: GATES_BUGFIX,
  },
  {
    id: 'refactor',
    translationKey: 'templates.refactor',
    priority: 'P2',
    agentPathKey: 'simple.agentPath.refactor',
    testPolicyKey: 'simple.testPolicy.refactor',
    workforceSequence: FEATURE_PERSONAS,
    primaryRuntime: 'Codex CLI',
    secondaryRuntime: 'Claude Code CLI',
    evalChecks: EVAL_ALL,
    gates: GATES_STANDARD,
  },
  {
    id: 'docs',
    translationKey: 'templates.docs',
    priority: 'P3',
    agentPathKey: 'simple.agentPath.docs',
    testPolicyKey: 'simple.testPolicy.docs',
    workforceSequence: DOCS_PERSONAS,
    primaryRuntime: 'Codex CLI',
    secondaryRuntime: 'Claude Code CLI',
    evalChecks: EVAL_DOCS,
    gates: [
      { id: 'spec-review', label: 'Spec review', kind: 'human' },
      { id: 'release-check', label: 'Release gate', kind: 'release' },
    ],
  },
  {
    id: 'integration',
    translationKey: 'templates.integration',
    priority: 'P1',
    agentPathKey: 'simple.agentPath.integration',
    testPolicyKey: 'simple.testPolicy.integration',
    workforceSequence: FEATURE_PERSONAS,
    primaryRuntime: 'Codex CLI',
    secondaryRuntime: 'Claude Code CLI',
    evalChecks: EVAL_ALL,
    gates: GATES_SECURITY,
  },
  {
    id: 'flow',
    translationKey: 'templates.flow',
    priority: 'P1',
    agentPathKey: 'simple.agentPath.flow',
    testPolicyKey: 'simple.testPolicy.flow',
    workforceSequence: FEATURE_PERSONAS,
    primaryRuntime: 'Codex CLI',
    secondaryRuntime: 'Claude Code CLI',
    evalChecks: EVAL_ALL,
    gates: [...GATES_STANDARD, { id: 'human-approval', label: 'Human approval', kind: 'human' }],
  },
];
