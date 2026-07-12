import {
  createDockerClient,
  inspectDockerImage,
  probeDockerDaemon,
  pullDockerImage,
  redactDockerAuth,
  registryAuthFromEnv,
  safeDockerMessage,
} from '@dofe/infra-docker';
import { LoopsDockerClient } from './loops-docker.client';

const mockDockerInstance = {};

jest.mock('@dofe/infra-docker', () => ({
  createDockerClient: jest.fn(() => mockDockerInstance),
  inspectDockerImage: jest.fn(),
  probeDockerDaemon: jest.fn(),
  pullDockerImage: jest.fn(),
  redactDockerAuth: jest.fn((message: string, auth?: { password?: string }) =>
    auth?.password ? message.replaceAll(auth.password, '***') : message,
  ),
  registryAuthFromEnv: jest.fn(),
  safeDockerMessage: jest.fn((message: string) => message),
}));

const mockedCreateDockerClient = createDockerClient as jest.Mock;
const mockedInspectDockerImage = inspectDockerImage as jest.Mock;
const mockedProbeDockerDaemon = probeDockerDaemon as jest.Mock;
const mockedPullDockerImage = pullDockerImage as jest.Mock;
const mockedRedactDockerAuth = redactDockerAuth as jest.Mock;
const mockedRegistryAuthFromEnv = registryAuthFromEnv as jest.Mock;
const mockedSafeDockerMessage = safeDockerMessage as jest.Mock;

describe('LoopsDockerClient (infra-docker adapter)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DOCKER_HOST;
    delete process.env.DOCKER_REGISTRY_SERVER;
    delete process.env.DOCKER_REGISTRY_USERNAME;
    delete process.env.DOCKER_REGISTRY_PASSWORD;
    mockedProbeDockerDaemon.mockResolvedValue({ ok: true, version: '25.0.1' });
    mockedInspectDockerImage.mockResolvedValue({ present: false });
    mockedPullDockerImage.mockResolvedValue({ ok: true, message: 'Image pulled.' });
    mockedRegistryAuthFromEnv.mockReturnValue(undefined);
    mockedSafeDockerMessage.mockImplementation((message: string) => message);
    mockedRedactDockerAuth.mockImplementation((message: string, auth?: { password?: string }) =>
      auth?.password ? message.replaceAll(auth.password, '***') : message,
    );
  });

  it('probes Docker through the shared client and daemon helpers', async () => {
    const client = new LoopsDockerClient();

    await expect(client.probeDaemon()).resolves.toEqual({ ok: true, version: '25.0.1' });
    expect(mockedCreateDockerClient).toHaveBeenCalledWith({ dockerHost: undefined });
    expect(mockedProbeDockerDaemon).toHaveBeenCalledWith(mockDockerInstance, 8000);
  });

  it('maps a failed shared daemon probe to an unavailable result', async () => {
    mockedProbeDockerDaemon.mockResolvedValue({ ok: false, message: 'connect ENOENT' });

    await expect(new LoopsDockerClient().probeDaemon()).resolves.toEqual({ ok: false });
  });

  it('checks local image presence through the shared image helper', async () => {
    mockedInspectDockerImage.mockResolvedValue({ present: true });

    await expect(new LoopsDockerClient().imagePresent('example/image:latest')).resolves.toBe(true);
    expect(mockedInspectDockerImage).toHaveBeenCalledWith(
      mockDockerInstance,
      'example/image:latest',
      8000,
    );
  });

  it('returns the shared successful pull outcome unchanged', async () => {
    mockedPullDockerImage.mockResolvedValue({
      ok: true,
      message: 'Image example/image:latest pulled successfully.',
    });

    await expect(new LoopsDockerClient().pull('example/image:latest')).resolves.toEqual({
      ok: true,
      message: 'Image example/image:latest pulled successfully.',
    });
    expect(mockedPullDockerImage).toHaveBeenCalledWith(
      mockDockerInstance,
      expect.objectContaining({
        image: 'example/image:latest',
        registryAuth: undefined,
        timeoutMs: 300000,
      }),
    );
  });

  it('passes registry credentials only through the shared pull API', async () => {
    const auth = {
      username: 'techwu',
      password: 'secret-token',
      serveraddress: 'https://uhub.service.ucloud.cn',
    };
    mockedRegistryAuthFromEnv.mockReturnValue(auth);

    await new LoopsDockerClient().pull('uhub.service.ucloud.cn/techwu/codex-cli@sha256:abc');

    expect(mockedRegistryAuthFromEnv).toHaveBeenCalledWith(
      'uhub.service.ucloud.cn/techwu/codex-cli@sha256:abc',
    );
    expect(mockedPullDockerImage).toHaveBeenCalledWith(
      mockDockerInstance,
      expect.objectContaining({
        image: 'uhub.service.ucloud.cn/techwu/codex-cli@sha256:abc',
        registryAuth: auth,
      }),
    );
  });

  it('redacts credentials and maps a shared 401 failure to an operator-safe message', async () => {
    const auth = {
      username: 'techwu',
      password: 'supersecret-token',
      serveraddress: 'https://uhub.service.ucloud.cn',
    };
    const logger = { warn: jest.fn(), debug: jest.fn(), info: jest.fn() };
    mockedRegistryAuthFromEnv.mockReturnValue(auth);
    mockedPullDockerImage.mockResolvedValue({
      ok: false,
      message: 'unauthorized: supersecret-token is invalid',
    });

    const result = await new LoopsDockerClient(logger as never).pull(
      'uhub.service.ucloud.cn/techwu/img:latest',
    );

    expect(result).toEqual({
      ok: false,
      message: 'Registry authentication failed. Check the Docker registry credentials.',
    });
    expect(mockedSafeDockerMessage).toHaveBeenCalledWith(
      'unauthorized: supersecret-token is invalid',
    );
    expect(mockedRedactDockerAuth).toHaveBeenCalledWith(
      'unauthorized: supersecret-token is invalid',
      auth,
    );
    const logged = logger.warn.mock.calls[0]?.[1];
    expect(logged.error).toContain('***');
    expect(logged.error).not.toContain('supersecret-token');
    expect(logged.auth).toBe('present');
  });
});
