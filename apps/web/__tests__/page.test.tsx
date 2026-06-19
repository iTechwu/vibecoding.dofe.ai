import { describe, it, expect } from 'vitest';

describe('Scaffold Test Example', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should verify the locale page renders', () => {
    // 当项目添加具体页面后，使用 @testing-library/react 的 render 进行测试
    expect(1 + 1).toBe(2);
  });
});
