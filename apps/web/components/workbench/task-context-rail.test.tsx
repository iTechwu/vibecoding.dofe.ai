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
});
