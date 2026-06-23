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
  agentPathKey: `simple.agentPath.${LoopIssueTemplateId}`;
  testPolicyKey: `simple.testPolicy.${LoopIssueTemplateId}`;
}

export const DEFAULT_LOOP_ISSUE_TEMPLATE: LoopIssueTemplate = {
  id: 'feature',
  translationKey: 'templates.feature',
  priority: 'P1',
  agentPathKey: 'simple.agentPath.feature',
  testPolicyKey: 'simple.testPolicy.feature',
};

export const LOOP_ISSUE_TEMPLATES: LoopIssueTemplate[] = [
  DEFAULT_LOOP_ISSUE_TEMPLATE,
  {
    id: 'bugfix',
    translationKey: 'templates.bugfix',
    priority: 'P0',
    agentPathKey: 'simple.agentPath.bugfix',
    testPolicyKey: 'simple.testPolicy.bugfix',
  },
  {
    id: 'refactor',
    translationKey: 'templates.refactor',
    priority: 'P2',
    agentPathKey: 'simple.agentPath.refactor',
    testPolicyKey: 'simple.testPolicy.refactor',
  },
  {
    id: 'docs',
    translationKey: 'templates.docs',
    priority: 'P3',
    agentPathKey: 'simple.agentPath.docs',
    testPolicyKey: 'simple.testPolicy.docs',
  },
  {
    id: 'integration',
    translationKey: 'templates.integration',
    priority: 'P1',
    agentPathKey: 'simple.agentPath.integration',
    testPolicyKey: 'simple.testPolicy.integration',
  },
  {
    id: 'flow',
    translationKey: 'templates.flow',
    priority: 'P1',
    agentPathKey: 'simple.agentPath.flow',
    testPolicyKey: 'simple.testPolicy.flow',
  },
];
