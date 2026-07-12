import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OidcCallbackPage from './page';

const mocks = vi.hoisted(() => ({
  searchParams: vi.fn(),
  pathname: vi.fn(),
  exchangeCode: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: mocks.searchParams,
  usePathname: mocks.pathname,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) =>
    ({
      errorTitle: 'Sign-in could not be completed',
      errorDescription: 'Please try signing in again.',
      backToLogin: 'Back to sign in',
      loading: 'Completing sign-in...',
    })[key] ?? key,
}));

vi.mock('@/lib/storage', () => ({
  setTokens: vi.fn(),
  setIdToken: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock('@/lib/api/contracts/client', () => ({
  oidcAuthClient: {
    exchangeCode: mocks.exchangeCode,
  },
}));

describe('OidcCallbackPage OAuth error state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchParams.mockReturnValue(
      new URLSearchParams(
        'error=invalid_scope&error_description=provider+detail+must+not+reach+the+screen',
      ),
    );
    mocks.pathname.mockReturnValue('/zh-CN/auth/oidc/success');
    window.history.replaceState(null, '', '/zh-CN/auth/oidc/success?error=invalid_scope');
  });

  it('shows a localized recoverable error without rendering the raw provider description', () => {
    render(<OidcCallbackPage />);

    expect(screen.getByRole('heading', { name: 'Sign-in could not be completed' })).toBeVisible();
    expect(screen.getByText('Please try signing in again.')).toBeVisible();
    expect(screen.queryByText('Completing sign-in...')).not.toBeInTheDocument();
    expect(screen.queryByText(/provider detail/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/zh-CN/login',
    );
    expect(mocks.exchangeCode).not.toHaveBeenCalled();
  });

  it('keeps the OAuth error visible after the URL query is cleaned', () => {
    const { rerender } = render(<OidcCallbackPage />);

    mocks.searchParams.mockReturnValue(new URLSearchParams());
    rerender(<OidcCallbackPage />);

    expect(screen.getByRole('heading', { name: 'Sign-in could not be completed' })).toBeVisible();
    expect(screen.queryByText('Completing sign-in...')).not.toBeInTheDocument();
  });
});
