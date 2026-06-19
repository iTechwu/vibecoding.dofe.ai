import { createI18nRootOptions, resolveAppZone, resolveProjectRoot } from './i18n.bootstrap';
import type { AppConfig } from '@dofe/infra-common';

const appConfig = {
  zones: [
    { zone: 'cn', locale: 'zh-CN' },
    { zone: 'us', locale: 'en-US' },
  ],
} as unknown as AppConfig;

describe('i18n bootstrap options', () => {
  it('defaults to the cn zone', () => {
    expect(resolveAppZone(appConfig).locale).toBe('zh-CN');
  });

  it('resolves the requested base zone', () => {
    expect(resolveAppZone(appConfig, 'us').locale).toBe('en-US');
  });

  it('throws when the zone is not found', () => {
    expect(() => resolveAppZone(appConfig, 'kr')).toThrow('Zone not found');
  });

  it('replaces $(pwd) in project root', () => {
    expect(resolveProjectRoot('$(pwd)/app', '/work')).toBe('/work/app');
  });

  it('falls back to cwd when project root is absent', () => {
    expect(resolveProjectRoot(undefined, '/work')).toBe('/work');
  });

  it('builds loader path under the infra-i18n dist', () => {
    const options = createI18nRootOptions({
      appConfig,
      projectRoot: '/root',
      cwd: '/root',
    });

    expect(options.fallbackLanguage).toBe('zh-CN');
    expect(options.loaderOptions.path).toContain('infra-i18n/dist');
    expect(options.loaderOptions.watch).toBe(true);
  });
});
