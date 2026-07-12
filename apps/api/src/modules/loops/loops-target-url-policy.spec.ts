import { BadRequestException } from '@nestjs/common';
import { assertLoopTargetUrlAllowed } from './loops-target-url-policy';

describe('assertLoopTargetUrlAllowed', () => {
  const resolvePublicHost = jest.fn(async () => [{ address: '93.184.216.34', family: 4 }]);

  beforeEach(() => {
    resolvePublicHost.mockClear();
  });

  it('permits an allowlisted HTTPS target that resolves to a public address in production', async () => {
    await expect(
      assertLoopTargetUrlAllowed('https://canary.example/releases/42', {
        env: {
          NODE_ENV: 'production',
          LOOPS_TARGET_URL_ALLOWLIST: 'canary.example',
        },
        resolveHost: resolvePublicHost,
      }),
    ).resolves.toEqual(new URL('https://canary.example/releases/42'));
  });

  it('rejects a loopback address even when its hostname is allowlisted', async () => {
    await expect(
      assertLoopTargetUrlAllowed('https://canary.example', {
        env: {
          NODE_ENV: 'production',
          LOOPS_TARGET_URL_ALLOWLIST: 'canary.example',
        },
        resolveHost: async () => [{ address: '127.0.0.1', family: 4 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('recognizes IPv6 loopback literals as private targets', async () => {
    await expect(
      assertLoopTargetUrlAllowed('https://[::1]', {
        env: { NODE_ENV: 'test' },
      }),
    ).rejects.toThrow('private, loopback, link-local, or reserved');
  });

  it('requires an explicit production allowlist and HTTPS', async () => {
    await expect(
      assertLoopTargetUrlAllowed('https://canary.example', {
        env: { NODE_ENV: 'production' },
        resolveHost: resolvePublicHost,
      }),
    ).rejects.toThrow('LOOPS_TARGET_URL_ALLOWLIST');

    await expect(
      assertLoopTargetUrlAllowed('http://canary.example', {
        env: {
          NODE_ENV: 'production',
          LOOPS_TARGET_URL_ALLOWLIST: 'canary.example',
        },
        resolveHost: resolvePublicHost,
      }),
    ).rejects.toThrow('HTTPS');
  });

  it('rejects credentials in the target URL', async () => {
    await expect(
      assertLoopTargetUrlAllowed('https://token@example.com', {
        env: { NODE_ENV: 'test' },
        resolveHost: resolvePublicHost,
      }),
    ).rejects.toThrow('must not contain credentials');
  });

  it('requires an explicit local-development override for private targets', async () => {
    await expect(
      assertLoopTargetUrlAllowed('http://localhost:3000', {
        env: { NODE_ENV: 'development' },
        resolveHost: async () => [{ address: '127.0.0.1', family: 4 }],
      }),
    ).rejects.toThrow('private, loopback, link-local, or reserved');

    await expect(
      assertLoopTargetUrlAllowed('http://localhost:3000', {
        env: {
          NODE_ENV: 'development',
          LOOPS_ALLOW_PRIVATE_TARGET_URLS: 'true',
        },
        resolveHost: async () => [{ address: '127.0.0.1', family: 4 }],
      }),
    ).resolves.toEqual(new URL('http://localhost:3000/'));
  });
});
