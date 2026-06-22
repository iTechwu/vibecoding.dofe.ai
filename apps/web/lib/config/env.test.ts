import { describe, expect, it } from 'vitest';
import { normalizeFrontendServerBaseUrl } from './env';

describe('frontend env', () => {
  it('upgrades local dofe API URLs on HTTPS pages', () => {
    expect(normalizeFrontendServerBaseUrl('http://api.vibecoding.local.dofe.ai', 'https:')).toBe(
      'https://api.vibecoding.local.dofe.ai',
    );
  });

  it('keeps localhost HTTP URLs for direct local development', () => {
    expect(normalizeFrontendServerBaseUrl('http://localhost:13100', 'https:')).toBe(
      'http://localhost:13100',
    );
  });

  it('does not change URLs on HTTP pages', () => {
    expect(normalizeFrontendServerBaseUrl('http://api.vibecoding.local.dofe.ai', 'http:')).toBe(
      'http://api.vibecoding.local.dofe.ai',
    );
  });
});
