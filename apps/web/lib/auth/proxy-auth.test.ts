import { describe, expect, it } from 'vitest';
import { hasValidAuthPresence, isPublicPath, shouldRedirectToLogin } from './proxy-auth';

describe('proxy auth guard', () => {
  it('treats login and OIDC callback pages as public', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/en/login')).toBe(true);
    expect(isPublicPath('/auth/oidc/success')).toBe(true);
    expect(isPublicPath('/zh-CN/auth/oidc/callback')).toBe(true);
  });

  it('accepts a non-expired auth presence cookie pair', () => {
    expect(
      hasValidAuthPresence({
        tokenPresence: '1',
        tokenExpire: String(Date.now() + 60_000),
      }),
    ).toBe(true);
  });

  it('redirects protected routes when auth presence is missing or expired', () => {
    expect(shouldRedirectToLogin({ pathname: '/', now: 1000 })).toBe(true);
    expect(
      shouldRedirectToLogin({
        pathname: '/loops',
        tokenPresence: '1',
        tokenExpire: '1',
        now: 2000,
      }),
    ).toBe(true);
  });

  it('allows protected routes when auth presence is valid', () => {
    expect(
      shouldRedirectToLogin({
        pathname: '/loops',
        tokenPresence: '1',
        tokenExpire: '2000',
        now: 1000,
      }),
    ).toBe(false);
  });
});
