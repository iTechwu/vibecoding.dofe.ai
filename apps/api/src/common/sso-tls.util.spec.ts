import { allowInsecureSsoTls } from './sso-tls.util';

describe('SSO TLS utilities', () => {
  it('allows insecure TLS when explicitly enabled', () => {
    expect(
      allowInsecureSsoTls({
        NODE_ENV: 'prod',
        SSO_ISSUER: 'https://sso.dofe.ai',
        SSO_ALLOW_INSECURE_TLS: 'true',
      }),
    ).toBe(true);
  });

  it('allows local-like SSO hosts in local-like environments', () => {
    expect(
      allowInsecureSsoTls({
        NODE_ENV: 'dev',
        SSO_ISSUER: 'https://sso.local.dofe.ai',
      }),
    ).toBe(true);
  });

  it('keeps production SSO strict by default', () => {
    expect(
      allowInsecureSsoTls({
        NODE_ENV: 'prod',
        SSO_ISSUER: 'https://sso.local.dofe.ai',
      }),
    ).toBe(false);
  });

  it('does not allow public SSO hosts implicitly', () => {
    expect(
      allowInsecureSsoTls({
        NODE_ENV: 'dev',
        SSO_ISSUER: 'https://sso.dofe.ai',
      }),
    ).toBe(false);
  });
});
