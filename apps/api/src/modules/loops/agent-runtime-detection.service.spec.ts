import type { LoopWorkspaceProfile } from '@repo/contracts';
import { AgentRuntimeDetectionService } from './agent-runtime-detection.service';
import type { LoopsDockerClient } from './loops-docker.client';

jest.mock('./adapters/loops-process.util');

const { runProcess } = require('./adapters/loops-process.util') as {
  runProcess: jest.Mock;
};

function buildWorkspace(overrides: Partial<LoopWorkspaceProfile> = {}): LoopWorkspaceProfile {
  return {
    workspaceId: 'default',
    root: '/host/repo',
    containerWorkdir: '/workspace',
    status: 'VALIDATED',
    isDefault: true,
    agents: {
      codex: { mode: 'local-cli', dockerImage: 'img/codex:latest' },
      'claude-code': { mode: 'local-cli', dockerImage: 'img/claude:latest' },
    },
    ...overrides,
  };
}

function fakeDocker(opts: { daemonOk?: boolean; present?: boolean }): LoopsDockerClient {
  return {
    probeDaemon: jest.fn().mockResolvedValue({ ok: opts.daemonOk ?? true, version: '24.0' }),
    imagePresent: jest.fn().mockResolvedValue(opts.present ?? true),
    pull: jest.fn(),
  } as unknown as LoopsDockerClient;
}

describe('AgentRuntimeDetectionService (0622 · B1)', () => {
  beforeEach(() => {
    runProcess.mockReset();
  });

  it('marks local CLI ready and emits no checks when everything is healthy', async () => {
    runProcess.mockResolvedValue({ exitCode: 0, stdout: 'codex 1.0\n', stderr: '' });
    const service = new AgentRuntimeDetectionService(undefined, fakeDocker({}));
    const detection = await service.detect('codex', buildWorkspace());
    expect(detection.local?.status).toBe('ready');
    expect(detection.local?.version).toBe('codex 1.0');
    expect(detection.docker?.status).toBe('ready');
    expect(detection.selected?.mode).toBe('local-cli');
    expect(detection.checks).toEqual([]);
  });

  it('falls back to Docker with an info-level LOCAL_CLI_MISSING when the local CLI is absent', async () => {
    runProcess.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'spawn codex ENOENT' });
    const service = new AgentRuntimeDetectionService(undefined, fakeDocker({}));
    const detection = await service.detect('codex', buildWorkspace());
    expect(detection.local?.status).toBe('missing');
    expect(detection.docker?.status).toBe('ready');
    expect(detection.selected?.mode).toBe('docker');
    const missing = detection.checks.find((c) => c.code === 'LOCAL_CLI_MISSING');
    expect(missing?.level).toBe('info');
    expect(missing?.action).toBe('use-docker');
  });

  it('emits DOCKER_DAEMON_DOWN (critical) when Docker is unavailable', async () => {
    runProcess.mockResolvedValue({ exitCode: 0, stdout: 'codex 1.0\n', stderr: '' });
    const service = new AgentRuntimeDetectionService(undefined, fakeDocker({ daemonOk: false }));
    const detection = await service.detect('codex', buildWorkspace());
    expect(detection.docker?.status).toBe('error');
    const daemon = detection.checks.find((c) => c.code === 'DOCKER_DAEMON_DOWN');
    expect(daemon?.level).toBe('critical');
    expect(daemon?.action).toBe('open-docker');
  });

  it('emits DOCKER_IMAGE_MISSING (warning, pull-image) when the image is absent', async () => {
    runProcess.mockResolvedValue({ exitCode: 0, stdout: 'codex 1.0\n', stderr: '' });
    const service = new AgentRuntimeDetectionService(undefined, fakeDocker({ present: false }));
    const detection = await service.detect('codex', buildWorkspace());
    const image = detection.checks.find((c) => c.code === 'DOCKER_IMAGE_MISSING');
    expect(image?.level).toBe('warning');
    expect(image?.action).toBe('pull-image');
  });

  it('emits WORKSPACE_NOT_MOUNTABLE when the workspace root is invalid', async () => {
    runProcess.mockResolvedValue({ exitCode: 0, stdout: 'codex 1.0\n', stderr: '' });
    const service = new AgentRuntimeDetectionService(undefined, fakeDocker({}));
    const detection = await service.detect('codex', buildWorkspace({ status: 'ERROR' }));
    const ws = detection.checks.find((c) => c.code === 'WORKSPACE_NOT_MOUNTABLE');
    expect(ws?.level).toBe('critical');
    expect(ws?.action).toBe('select-workspace');
  });
});
