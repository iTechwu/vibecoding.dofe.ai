import {
  getDockerConnectionOptions,
  getLocalImageId,
  pullImage as pullDockerImage,
} from '@dofe/infra-docker/docker.utils';
import { LoopsDockerClient } from './loops-docker.client';

const mockDockerInstance = {
  ping: jest.fn(),
  version: jest.fn(),
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
    mockDockerInstance.ping.mockResolvedValue({});
    mockDockerInstance.version.mockResolvedValue({ Version: '25.0.1' });
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
});
