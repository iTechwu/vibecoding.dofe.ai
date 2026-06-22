import {
  buildDockerAgentCommand,
  buildLocalAgentCommand,
  planAgentInvocation,
} from './loops-runtime-command-builder.util';
import { LOOPS_RUNTIME_IMAGES } from './loops-runtime-images';

describe('loops runtime command builder (0622 · B3)', () => {
  const agentArgs = ['exec', '--json', 'prompt'];
  const workspaceRoot = '/host/repo';

  it('builds a local-CLI invocation running against the host workspace', () => {
    const cmd = buildLocalAgentCommand({ agent: 'codex', workspaceRoot, agentArgs });
    expect(cmd.command).toBe('codex');
    expect(cmd.args).toEqual(agentArgs);
    expect(cmd.cwd).toBe(workspaceRoot);
  });

  it('builds a Docker invocation that only mounts the workspace root + config dir', () => {
    const cmd = buildDockerAgentCommand({ agent: 'claude-code', workspaceRoot, agentArgs });
    expect(cmd.command).toBe('docker');
    expect(cmd.args[0]).toBe('run');
    expect(cmd.args).toContain('--rm');
    // Only the workspace root is mounted at /workspace.
    const mountFlag = cmd.args.indexOf('-v');
    expect(cmd.args[mountFlag + 1]).toBe(`${workspaceRoot}:/workspace`);
    expect(cmd.cwd).toBe('/workspace');
    // Image is the fixed fallback image, not leaked elsewhere.
    expect(cmd.args).toContain(LOOPS_RUNTIME_IMAGES['claude-code']);
    // Config env points inside the container, never at a global ~/.config.
    expect(cmd.env['CLAUDE_CONFIG_DIR']).toContain('/workspace/.loops/runtime');
  });

  it('planAgentInvocation: local mode for local-cli preference', () => {
    const inv = planAgentInvocation({
      mode: 'local-cli',
      agent: 'codex',
      hostWorkspaceRoot: workspaceRoot,
      containerWorkdir: '/workspace',
      buildAgentArgs: (wd) => ['--add-dir', wd],
    });
    expect(inv.command).toBe('codex');
    expect(inv.args).toEqual(['--add-dir', workspaceRoot]);
    expect(inv.cwd).toBe(workspaceRoot);
  });

  it('planAgentInvocation: docker mode wraps argv with the container path', () => {
    const inv = planAgentInvocation({
      mode: 'docker',
      agent: 'claude-code',
      hostWorkspaceRoot: workspaceRoot,
      containerWorkdir: '/workspace',
      buildAgentArgs: (wd) => ['--add-dir', wd],
    });
    expect(inv.command).toBe('docker');
    // buildAgentArgs received the container workdir, not the host path.
    expect(inv.args).toContain('--add-dir');
    expect(inv.args).toContain('/workspace');
    expect(inv.args).not.toContain(workspaceRoot);
  });
});
