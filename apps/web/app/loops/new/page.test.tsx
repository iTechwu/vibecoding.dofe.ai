import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewLoopIssuePage from './page';

const mocks = vi.hoisted(() => ({ getTranslations: vi.fn() }));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    className,
    href,
  }: React.PropsWithChildren<{ className?: string; href: string }>) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

vi.mock('./simple-loop-issue-form', () => ({
  default: () => <div data-testid="simple-loop-issue-form">Simple issue form</div>,
}));

describe('NewLoopIssuePage', () => {
  beforeEach(() => {
    mocks.getTranslations.mockResolvedValue(
      (key: string) =>
        ({
          eyebrow: 'Web Issue Intake',
          title: 'New Issue',
          back: 'Back to Issues',
          'workbench.subtitle': 'Describe the delivery intent once.',
        })[key] ?? key,
    );
  });

  it('composes one page title, return link, and simple form', async () => {
    render(await NewLoopIssuePage());

    expect(screen.getByRole('heading', { name: 'New Issue' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Issues' })).toHaveAttribute('href', '/loops');
    expect(screen.getByTestId('simple-loop-issue-form')).toBeInTheDocument();
  });
});
