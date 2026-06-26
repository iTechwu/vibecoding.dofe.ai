import { LoopsRemoteRunnersService } from './loops-remote-runners.service';

describe('LoopsRemoteRunnersService.uploadRemoteRunnerArtifacts', () => {
  function buildService(artifacts: Record<string, string | null>) {
    const store = {
      readRemoteRunnerArtifact: jest.fn(
        (_runnerId: string, _jobId: string, kind: string) => artifacts[kind] ?? null,
      ),
    };
    const service = new LoopsRemoteRunnersService(store as never);
    return { service, store };
  }

  it('returns a .loops-only message when no storage port is wired', async () => {
    const { service } = buildService({ manifest: '{}' });
    const result = await service.uploadRemoteRunnerArtifacts('rr-1', 'job-1', {});
    expect(result.uploaded).toBe(0);
    expect(result.message).toContain('.loops only');
  });

  it('uploads each present artifact kind and returns a signed url per kind', async () => {
    const { service } = buildService({
      manifest: '{"m":1}',
      'worker-log': 'log line',
      'worker-receipt': null,
      trace: '{"t":1}',
    });
    const storagePort = {
      upload: jest.fn().mockResolvedValue(undefined),
      privateDownloadUrl: jest
        .fn()
        .mockImplementation((_v: string, _b: string, key: string) =>
          Promise.resolve(`https://download/${key}`),
        ),
    };
    const logSink = { log: jest.fn() };

    const result = await service.uploadRemoteRunnerArtifacts(
      'rr-1',
      'job-1',
      { vendor: 'oss', bucket: 'dofe-public' },
      storagePort,
      logSink,
    );

    expect(result.uploaded).toBe(3);
    expect(result.artifacts.map((a) => a.kind).sort()).toEqual(
      ['manifest', 'trace', 'worker-log'].sort(),
    );
    expect(storagePort.upload).toHaveBeenCalledTimes(3);
    expect(logSink.log).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('Uploaded 3'),
      expect.objectContaining({ uploaded: 3 }),
    );
  });

  it('skips individual artifact kinds that throw and keeps going', async () => {
    const { service } = buildService({ manifest: '{}', trace: '{}' });
    const storagePort = {
      upload: jest
        .fn()
        .mockImplementation((_v, _b, key: string) =>
          key.endsWith('manifest.json') ? Promise.reject(new Error('boom')) : Promise.resolve(),
        ),
      privateDownloadUrl: jest.fn().mockResolvedValue('https://download/trace'),
    };

    const result = await service.uploadRemoteRunnerArtifacts('rr-1', 'job-1', {}, storagePort);

    expect(result.uploaded).toBe(1);
    expect(result.artifacts.map((a) => a.kind)).toEqual(['trace']);
  });
});
