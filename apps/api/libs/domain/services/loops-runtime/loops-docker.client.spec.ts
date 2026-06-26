import {
  getDockerConnectionOptions,
  getLocalImageId,
  pullImage as pullDockerImage,
} from '@dofe/infra-docker/docker.utils';
import { LoopsDockerClient } from './loops-docker.client';

const mockModem = { followProgress: jest.fn() };
const mockDockerInstance = {
  ping: jest.fn(),
  version: jest.fn(),
  pull: jest.fn(),
  modem: mockModem,
};

jest.mock('dockerode', () => jest.fn(() => mockDockerInstance));

jest.mock('@dofe/infra-docker/docker.utils', () => ({
  getDockerConnectionOptions: jest.fn(() => ({ socketPath: '/var/run/docker.sock' })),
  getLocalImageId: jest.fn(),
  pullImage: jest.fn(),
}));

const mockedGetDockerConnectionOptions = getDockerConnectionOptions as jest.Mock;
const mockedGetLocalImageId = getLocalImageId as jest.Mock;
const mockedPullDockerImage = pullDockerImage as jest.Mock;

describe('LoopsDockerClient (0622 · infra-docker adapter)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DOCKER_HOST;
    delete process.env.DOCKER_REGISTRY_SERVER;
    delete process.env.DOCKER_REGISTRY_USERNAME;
    delete process.env.DOCKER_REGISTRY_PASSWORD;
    mockDockerInstance.ping.mockResolvedValue({});
    mockDockerInstance.version.mockResolvedValue({ Version: '25.0.1' });
    // Default authenticated-pull flow resolves immediately (overridden per test).
    mockDockerInstance.pull.mockImplementation((_image, _opts, cb) => cb(null, {}));
    mockModem.followProgress.mockImplementation((_stream, done) => done());
  });

  it('probes Docker Engine through @dofe/infra-docker connection options', async () => {
    const client = new LoopsDockerClient();

    const result = await client.probeDaemon();

    expect(result).toEqual({ ok: true, version: '25.0.1' });
    expect(mockedGetDockerConnectionOptions).toHaveBeenCalledWith('/var/run/docker.sock');
    expect(mockDockerInstance.ping).toHaveBeenCalledTimes(1);
    expect(mockDockerInstance.version).toHaveBeenCalledTimes(1);
  });

  it('maps daemon errors to an unavailable probe without throwing', async () => {
    mockDockerInstance.ping.mockRejectedValue(new Error('connect ENOENT'));
    const client = new LoopsDockerClient();

    await expect(client.probeDaemon()).resolves.toEqual({ ok: false });
  });

  it('checks local image presence through infra-docker image helpers', async () => {
    mockedGetLocalImageId.mockResolvedValue('sha256:image-id');
    const client = new LoopsDockerClient();

    await expect(client.imagePresent('example/image:latest')).resolves.toBe(true);
    expect(mockedGetLocalImageId).toHaveBeenCalledWith(expect.anything(), 'example/image:latest');
  });

  it('pulls images through infra-docker and redacts failure details from callers', async () => {
    const client = new LoopsDockerClient();
    mockedPullDockerImage.mockResolvedValueOnce(undefined);
    await expect(client.pull('example/image:latest')).resolves.toEqual({
      ok: true,
      message: 'Image example/image:latest pulled successfully.',
    });

    mockedPullDockerImage.mockRejectedValueOnce(new Error('registry token secret=abc failed'));
    await expect(client.pull('example/image:latest')).resolves.toEqual({
      ok: false,
      message: 'Docker image pull failed.',
    });
  });

  it('authenticates private-registry pulls when DOCKER_REGISTRY_* credentials are set', async () => {
    process.env.DOCKER_REGISTRY_SERVER = 'uhub.service.ucloud.cn';
    process.env.DOCKER_REGISTRY_USERNAME = 'techwu';
    process.env.DOCKER_REGISTRY_PASSWORD = 'secret-token';
    mockDockerInstance.pull.mockImplementation((_image, _opts, cb) => cb(null, {}));
    mockModem.followProgress.mockImplementation((_stream, done) => done());
    const client = new LoopsDockerClient();

    const result = await client.pull('uhub.service.ucloud.cn/techwu/codex-cli@sha256:abc');

    expect(result.ok).toBe(true);
    // Authenticated path bypasses the unauthenticated shared util.
    expect(mockedPullDockerImage).not.toHaveBeenCalled();
    expect(mockDockerInstance.pull).toHaveBeenCalledWith(
      'uhub.service.ucloud.cn/techwu/codex-cli@sha256:abc',
      expect.objectContaining({
        authconfig: expect.objectContaining({
          username: 'techwu',
          password: 'secret-token',
          serveraddress: 'https://uhub.service.ucloud.cn',
        }),
      }),
      expect.any(Function),
    );
  });

  it('falls back to the unauthenticated util when no registry credentials are configured', async () => {
    const client = new LoopsDockerClient();
    mockedPullDockerImage.mockResolvedValueOnce(undefined);

    await client.pull('uhub.service.ucloud.cn/techwu/codex-cli@sha256:abc');

    expect(mockDockerInstance.pull).not.toHaveBeenCalled();
    expect(mockedPullDockerImage).toHaveBeenCalled();
  });

  it('withholds credentials for images outside the configured registry', async () => {
    process.env.DOCKER_REGISTRY_SERVER = 'uhub.service.ucloud.cn';
    process.env.DOCKER_REGISTRY_USERNAME = 'techwu';
    process.env.DOCKER_REGISTRY_PASSWORD = 'secret-token';
    mockedPullDockerImage.mockResolvedValueOnce(undefined);
    const client = new LoopsDockerClient();

    // A Docker Hub library image is not the configured private registry, so no
    // auth is attached and the unauthenticated util path is used.
    await client.pull('library/nginx:latest');

    expect(mockDockerInstance.pull).not.toHaveBeenCalled();
    expect(mockedPullDockerImage).toHaveBeenCalledWith(
      expect.anything(),
      'library/nginx:latest',
      expect.any(Number),
    );
  });

  it('redacts registry credentials and surfaces an auth-failure message on 401', async () => {
    process.env.DOCKER_REGISTRY_SERVER = 'uhub.service.ucloud.cn';
    process.env.DOCKER_REGISTRY_USERNAME = 'techwu';
    process.env.DOCKER_REGISTRY_PASSWORD = 'supersecret-token';
    mockDockerInstance.pull.mockImplementation((_image, _opts, cb) =>
      cb(new Error('unauthorized: supersecret-token is invalid'), null),
    );
    const logger = { warn: jest.fn(), debug: jest.fn(), info: jest.fn() };

    const client = new LoopsDockerClient(logger as any);

    const result = await client.pull('uhub.service.ucloud.cn/techwu/img:latest');

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      'Registry authentication failed. Check the Docker registry credentials.',
    );
    // Password never reaches the surfaced message...
    expect(result.message).not.toContain('supersecret-token');
    // ...nor the structured log payload — only the redacted form and the
    // presence flag are logged, never the auth object itself.
    const logged = logger.warn.mock.calls[0]?.[1];
    expect(logged.error).not.toContain('supersecret-token');
    expect(logged.error).toContain('***');
    expect(logged.auth).toBe('present');
  });
});
