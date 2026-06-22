import {
  buildLoopIssueTitle,
  inferLoopIssueTemplate,
  normaliseSimpleIssue,
  DEFAULT_SIMPLE_ACCEPTANCE_CRITERIA,
} from '@repo/contracts';

describe('loops simple-issue normalisation (0622 · B4)', () => {
  it('infers template from keywords (auto mode)', () => {
    expect(inferLoopIssueTemplate('修复登录后跳转异常')).toBe('bugfix');
    expect(inferLoopIssueTemplate('Add a Docker fallback for the CLI')).toBe('integration');
    expect(inferLoopIssueTemplate('Refactor and simplify the runner')).toBe('refactor');
    expect(inferLoopIssueTemplate('更新安装文档')).toBe('docs');
    expect(inferLoopIssueTemplate('something totally unrelated to any keyword')).toBe('feature');
  });

  it('builds a deterministic title from the first sentence, trimming spoken prefixes', () => {
    // Chinese: spoken prefix stripped, trailing full stop trimmed, no English verb.
    expect(buildLoopIssueTitle('帮我修复登录后跳转异常。', 'bugfix')).toBe('修复登录后跳转异常');
    // English ASCII: feature verb prepended when the title does not already start with one.
    expect(buildLoopIssueTitle('a docker fallback for the codex runtime.', 'feature')).toBe(
      'Add a docker fallback for the codex runtime',
    );
  });

  it('truncates long titles to 80 characters', () => {
    const long = 'x'.repeat(200);
    const title = buildLoopIssueTitle(long, 'feature');
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith('...')).toBe(true);
  });

  it('normalises a one-sentence request into a full issue, preserving the request as body', () => {
    const result = normaliseSimpleIssue({
      request: '修复登录后跳转异常',
      template: 'auto',
      targetRepo: '/repo/app',
    });
    expect(result.template).toBe('bugfix');
    expect(result.priority).toBe('P0'); // bugfix default
    expect(result.title).toBe('修复登录后跳转异常');
    expect(result.body).toBe('修复登录后跳转异常'); // verbatim
    expect(result.acceptanceCriteria).toEqual(DEFAULT_SIMPLE_ACCEPTANCE_CRITERIA.bugfix);
    expect(result.targetRepo).toBe('/repo/app');
  });

  it('respects caller overrides over generated defaults', () => {
    const result = normaliseSimpleIssue({
      request: 'some request that is long enough',
      template: 'feature',
      title: 'My custom title',
      priority: 'P3',
      acceptanceCriteria: ['- custom criterion'],
      targetRepo: '/repo/app',
    });
    expect(result.title).toBe('My custom title');
    expect(result.priority).toBe('P3');
    expect(result.acceptanceCriteria).toEqual(['- custom criterion']);
  });
});
