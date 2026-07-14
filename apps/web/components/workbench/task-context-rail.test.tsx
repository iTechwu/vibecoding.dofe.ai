import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TaskContextRail } from './task-context-rail';

describe('TaskContextRail', () => {
  it('renders delivery progress, environment, changes, and validation as text', () => {
    render(
      <TaskContextRail
        changes={{ added: 12, removed: 2 }}
        environment="main · local"
        stages={[
          { label: 'Analysis', status: 'complete' },
          { label: 'Implementation', status: 'current' },
          { label: 'Validation', status: 'upcoming' },
        ]}
        validation="18 / 18 passed"
      />,
    );

    expect(screen.getByRole('complementary', { name: 'Delivery tracking' })).toBeInTheDocument();
    expect(screen.getByText('Implementation')).toBeInTheDocument();
    expect(screen.getByText('main · local')).toBeInTheDocument();
    expect(screen.getByText('+12')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('18 / 18 passed')).toBeInTheDocument();
  });

  it('uses a readable blocked label instead of color alone', () => {
    render(
      <TaskContextRail
        environment="Unavailable"
        stages={[{ label: 'Implementation', status: 'blocked' }]}
        validation="Validation unavailable"
      />,
    );

    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('accepts page-level labels for the default Chinese experience', () => {
    render(
      <TaskContextRail
        environment="不可用"
        labels={{
          changes: '变更',
          complete: '已完成',
          current: '进行中',
          deliveryProgress: '交付进度',
          deliveryTracking: '交付追踪',
          environment: '环境',
          upcoming: '待执行',
          validation: '验证',
        }}
        stages={[{ label: '实现', status: 'current' }]}
        validation="等待验证"
      />,
    );

    expect(screen.getByRole('complementary', { name: '交付追踪' })).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('环境')).toBeInTheDocument();
  });
});
