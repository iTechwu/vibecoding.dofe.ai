import { createAppModuleImports, getAppModuleImportNames } from './app-module-imports.bootstrap';

jest.mock('@dofe/infra-common', () => ({
  getConfig: jest.fn(() => ({ app: { zone: 'cn', projectRoot: process.cwd() } })),
  AppVersionModule: class AppVersionModule {},
  CacheDecoratorModule: class CacheDecoratorModule {},
  EventDecoratorModule: class EventDecoratorModule {},
  FeatureFlagModule: class FeatureFlagModule {},
  VersionDecoratorModule: class VersionDecoratorModule {},
}));

jest.mock('@dofe/infra-utils', () => ({
  getWinstonConfig: jest.fn(() => ({ transports: [] })),
}));

jest.mock('@dofe/infra-redis', () => ({
  RedisModule: class RedisModule {},
}));

jest.mock('@dofe/infra-jwt', () => ({
  JwtModule: class JwtModule {},
}));

jest.mock('@dofe/infra-clients', () => ({
  VerifyModule: class VerifyModule {},
}));

jest.mock('@dofe/infra-shared-services', () => ({
  SystemHealthModule: class SystemHealthModule {},
}));

jest.mock('@app/services/ip-info', () => ({
  IpInfoServiceModule: class IpInfoServiceModule {},
}));

jest.mock('../modules/loops/loops.module', () => ({
  LoopsModule: class LoopsModule {},
}));

jest.mock('../modules/oidc-client-api/oidc-client-api.module', () => ({
  OidcClientApiModule: class OidcClientApiModule {},
}));

jest.mock('@app/auth', () => ({
  AuthModule: class AuthModule {},
}));

describe('app module imports bootstrap', () => {
  it('keeps startup infrastructure imports before feature modules', () => {
    const names = getAppModuleImportNames(
      createAppModuleImports({ redisUrl: 'redis://localhost:6379' }),
    );

    expect(names.slice(0, 15)).toEqual([
      'ConfigModule',
      'WinstonModule',
      'I18nModule',
      'BullModule',
      'IpInfoServiceModule',
      'ScheduleModule',
      'RedisModule',
      'CacheDecoratorModule',
      'EventDecoratorModule',
      'VersionDecoratorModule',
      'FeatureFlagModule',
      'AppVersionModule',
      'VerifyModule',
      'SystemHealthModule',
      'JwtModule',
    ]);
    expect(names).toEqual(
      expect.arrayContaining(['OidcClientApiModule', 'AuthModule', 'LoopsModule']),
    );
    expect(names).not.toContain('UploaderModule');
  });
});
