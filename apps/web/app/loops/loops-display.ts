type LoopDisplayLocale = 'en' | 'zh';

const ZH_LABELS: Record<string, string> = {
  APPROVED: '已批准',
  ARCHIVED: '已归档',
  BLOCKED: '受阻',
  CLOSED: '已关闭',
  CONVERGENCE_READY: '可收尾交付',
  CONTEXT_BUDGET_EXCEEDED: '上下文余量不足',
  COST_GUARD_TRIPPED: '成本保护已触发',
  DONE: '已完成',
  DRAFT: '待审阅',
  FAILED: '失败',
  FAIL: '未通过',
  FINALIZED: '已交付',
  HUMAN_INTERVENTION: '需要人工处理',
  IMPLEMENTATION_RECORD: '已记录实现',
  IN_LOOP: '执行中',
  IN_PROGRESS: '进行中',
  ISSUE_NORMALIZED: '需求已整理',
  ISSUE_RECEIVED: '已收到需求',
  LOOP_STEP: '流程已推进',
  NEEDS_CLARIFICATION: '需要补充信息',
  NEEDS_WORK: '需要修改',
  NORMALIZED: '已整理',
  NOTIFICATION_RECORDED: '通知已记录',
  OPEN: '待处理',
  PASS: '通过',
  PAUSED: '已暂停',
  PENDING: '待处理',
  PHASE_0_INTAKE: '录入',
  PHASE_1_SPEC: '规格',
  PHASE_2_REVIEW: '审阅',
  PHASE_3_DECOMPOSE: '拆解',
  PHASE_4_IMPLEMENT: '实现',
  PHASE_5_REVIEW: '分片审阅',
  PHASE_6_CONVERGE: '收敛',
  PHASE_7_GLOBAL_REVIEW: '全局审阅',
  PHASE_8_ANNOTATE: '标注',
  RECORDED: '已记录',
  REJECTED: '已拒绝',
  RELOOP_LIMIT: '返工次数已达上限',
  REVIEW_RECORD: '已记录审阅',
  REVISION_REQUESTED: '需要修订',
  SENT: '已发送',
  SHARD_REDO_LIMIT: '分片重做已达上限',
  SKIPPED: '已跳过',
  SPEC_REVIEW_REQUESTED: '等待规格审阅',
  TEST_PASS: '测试通过',
  TIMEOUT: '超时',
};

const EN_LABELS: Record<string, string> = {
  APPROVED: 'Approved',
  ARCHIVED: 'Archived',
  BLOCKED: 'Blocked',
  CLOSED: 'Closed',
  CONVERGENCE_READY: 'Ready to finalize',
  CONTEXT_BUDGET_EXCEEDED: 'Context budget needs attention',
  COST_GUARD_TRIPPED: 'Cost guard needs review',
  DONE: 'Done',
  DRAFT: 'Ready for review',
  FAILED: 'Failed',
  FAIL: 'Failed review',
  FINALIZED: 'Finalized',
  HUMAN_INTERVENTION: 'Needs human input',
  IMPLEMENTATION_RECORD: 'Implementation recorded',
  IN_LOOP: 'In progress',
  IN_PROGRESS: 'In progress',
  ISSUE_NORMALIZED: 'Request prepared',
  ISSUE_RECEIVED: 'Request received',
  LOOP_STEP: 'Loop advanced',
  NEEDS_CLARIFICATION: 'Needs clarification',
  NEEDS_WORK: 'Needs work',
  NORMALIZED: 'Prepared',
  NOTIFICATION_RECORDED: 'Notification saved',
  OPEN: 'Open',
  PASS: 'Passed',
  PAUSED: 'Paused',
  PENDING: 'Pending',
  PHASE_0_INTAKE: 'Intake',
  PHASE_1_SPEC: 'Spec',
  PHASE_2_REVIEW: 'Review',
  PHASE_3_DECOMPOSE: 'Decompose',
  PHASE_4_IMPLEMENT: 'Implement',
  PHASE_5_REVIEW: 'Shard Review',
  PHASE_6_CONVERGE: 'Converge',
  PHASE_7_GLOBAL_REVIEW: 'Global Review',
  PHASE_8_ANNOTATE: 'Annotate',
  RECORDED: 'Saved',
  REJECTED: 'Rejected',
  RELOOP_LIMIT: 'Re-loop limit reached',
  REVIEW_RECORD: 'Review recorded',
  REVISION_REQUESTED: 'Revision requested',
  SENT: 'Sent',
  SHARD_REDO_LIMIT: 'Shard retry limit reached',
  SKIPPED: 'Skipped',
  SPEC_REVIEW_REQUESTED: 'Spec review requested',
  TEST_PASS: 'Test passed',
  TIMEOUT: 'Timed out',
};

function normalizeDisplayKey(value: string) {
  return value.trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');
}

function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getLoopDisplayLocale(locale?: string): LoopDisplayLocale {
  return locale?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function formatLoopLabel(value?: string | null, locale?: string) {
  if (!value) return '';
  const displayLocale = getLoopDisplayLocale(locale);
  const key = normalizeDisplayKey(value);
  const labels = displayLocale === 'zh' ? ZH_LABELS : EN_LABELS;
  return labels[key] ?? toTitleCase(value);
}

export function formatLoopSignal(value?: string | null, locale?: string) {
  return formatLoopLabel(value, locale);
}

export function formatLoopEvent(value?: string | null, locale?: string) {
  return formatLoopLabel(value, locale);
}

export function formatLoopStatus(value?: string | null, locale?: string) {
  return formatLoopLabel(value, locale);
}
