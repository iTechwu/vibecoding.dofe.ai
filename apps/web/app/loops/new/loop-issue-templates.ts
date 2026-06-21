export type LoopIssueTemplateId =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'docs'
  | 'integration'
  | 'flow';

export interface LoopIssueTemplate {
  id: LoopIssueTemplateId;
  translationKey: `templates.${LoopIssueTemplateId}`;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

export const DEFAULT_LOOP_ISSUE_TEMPLATE: LoopIssueTemplate = {
  id: 'feature',
  translationKey: 'templates.feature',
  priority: 'P1',
};

export const LOOP_ISSUE_TEMPLATES: LoopIssueTemplate[] = [
  DEFAULT_LOOP_ISSUE_TEMPLATE,
  {
    id: 'bugfix',
    translationKey: 'templates.bugfix',
    priority: 'P0',
  },
  {
    id: 'refactor',
    translationKey: 'templates.refactor',
    priority: 'P2',
  },
  {
    id: 'docs',
    translationKey: 'templates.docs',
    priority: 'P3',
  },
  {
    id: 'integration',
    translationKey: 'templates.integration',
    priority: 'P1',
  },
  {
    id: 'flow',
    translationKey: 'templates.flow',
    priority: 'P1',
  },
];
