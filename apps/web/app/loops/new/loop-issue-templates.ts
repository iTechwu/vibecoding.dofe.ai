export type LoopIssueTemplateId =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'docs'
  | 'integration'
  | 'flow';

export interface LoopIssueTemplate {
  id: LoopIssueTemplateId;
  label: string;
  description: string;
  bestFor: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  body: string;
  acceptanceCriteria: string[];
}

export const DEFAULT_LOOP_ISSUE_TEMPLATE: LoopIssueTemplate = {
  id: 'feature',
  label: 'Feature Loop',
  description: 'Plan and deliver a user-facing capability with evidence across UX, API, and tests.',
  bestFor: 'New product workflows or visible user value',
  priority: 'P1',
  body: [
    'Background:',
    '-',
    '',
    'User goal:',
    '-',
    '',
    'Scope:',
    '-',
    '',
    'Out of scope:',
    '-',
  ].join('\n'),
  acceptanceCriteria: [
    'Primary happy path is implemented end to end',
    'User-facing states cover loading, empty, success, and error outcomes',
    'Backend/API contract is validated with tests when data changes are involved',
    'Regression tests pass and implementation evidence is recorded',
  ],
};

export const LOOP_ISSUE_TEMPLATES: LoopIssueTemplate[] = [
  DEFAULT_LOOP_ISSUE_TEMPLATE,
  {
    id: 'bugfix',
    label: 'Bugfix Loop',
    description: 'Capture reproduction, isolate root cause, and require regression coverage.',
    bestFor: 'Production defects or behavior regressions',
    priority: 'P0',
    body: [
      'Observed behavior:',
      '-',
      '',
      'Expected behavior:',
      '-',
      '',
      'Reproduction steps:',
      '1.',
      '2.',
      '3.',
      '',
      'Impact:',
      '-',
    ].join('\n'),
    acceptanceCriteria: [
      'Root cause is identified and described in the implementation evidence',
      'The reproduction path now passes',
      'A regression test covers the fixed behavior',
      'No unrelated behavior is changed',
    ],
  },
  {
    id: 'refactor',
    label: 'Refactor Loop',
    description: 'Change internals while protecting public behavior and contracts.',
    bestFor: 'Complexity reduction without product behavior changes',
    priority: 'P2',
    body: [
      'Current pain:',
      '-',
      '',
      'Refactor target:',
      '-',
      '',
      'Behavior that must stay unchanged:',
      '-',
      '',
      'Risk areas:',
      '-',
    ].join('\n'),
    acceptanceCriteria: [
      'External behavior and public contracts remain compatible',
      'Duplication or complexity is reduced in the target area',
      'Existing tests pass and focused coverage is added for touched shared behavior',
      'No unrelated formatting or metadata churn is introduced',
    ],
  },
  {
    id: 'docs',
    label: 'Docs Loop',
    description:
      'Update product, architecture, or implementation docs with explicit status labels.',
    bestFor: 'Specification, runbook, and release-note work',
    priority: 'P3',
    body: [
      'Audience:',
      '-',
      '',
      'Documentation goal:',
      '-',
      '',
      'Source of truth:',
      '-',
      '',
      'Pages or files to update:',
      '-',
    ].join('\n'),
    acceptanceCriteria: [
      'Documentation matches the current implementation',
      'Status labels clearly distinguish done, accepted, planned, and blocked work',
      'Commands or examples are accurate and runnable where applicable',
      'Any deferred work includes the reason and required next input',
    ],
  },
  {
    id: 'integration',
    label: 'Integration Loop',
    description: 'Define external system boundaries, credentials, failure handling, and evidence.',
    bestFor: 'Git provider, Feishu, worker, or third-party API work',
    priority: 'P1',
    body: [
      'External system:',
      '-',
      '',
      'Trigger or data flow:',
      '-',
      '',
      'Credentials or environment needed:',
      '-',
      '',
      'Failure handling:',
      '-',
    ].join('\n'),
    acceptanceCriteria: [
      'Integration client boundary is isolated from service logic',
      'Missing credentials or external failures degrade safely',
      'Success and failure paths are covered by tests or documented smoke checks',
      'Operational logs avoid raw sensitive values',
    ],
  },
  {
    id: 'flow',
    label: 'Flow Loop',
    description: 'Model a stateful agent workflow with triggers, HITL gates, resume, and tracing.',
    bestFor: 'CrewAI-style Flow, approval, or recovery workflows',
    priority: 'P1',
    body: [
      'Trigger:',
      '-',
      '',
      'State transitions:',
      '-',
      '',
      'Human-in-the-loop gate:',
      '-',
      '',
      'Resume point:',
      '-',
      '',
      'Observability:',
      '-',
    ].join('\n'),
    acceptanceCriteria: [
      'Trigger conditions and input payload are explicitly defined',
      'State transitions include success, failure, pause, and resume paths',
      'Human approval or takeover gate is visible before irreversible work',
      'Resume point and recovery behavior are documented with evidence',
      'Trace, notification, and regression evidence are recorded for the flow',
    ],
  },
];
