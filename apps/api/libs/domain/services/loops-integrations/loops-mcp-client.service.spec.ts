/**
 * MCP Client unit tests — protocol compliance, edge cases, error handling.
 *
 * Uses a mock child_process.spawn to simulate MCP server responses without
 * requiring a real MCP server on the test machine.
 */
import { LoopsMcpClientService, McpClientOptions, McpTool } from './loops-mcp-client.service';

// ---------------------------------------------------------------------------
// Mock child_process — simulates a compliant MCP server over stdio
// ---------------------------------------------------------------------------
let mockSpawn: jest.Mock;

function mockMcpServer(
  responses: Array<{
    id?: number | string;
    result?: unknown;
    error?: { code: number; message: string };
  }>,
) {
  const pending = [...responses];
  const child = {
    stdin: { write: jest.fn(), end: jest.fn(), destroy: jest.fn() },
    stdout: {
      on: jest.fn(),
      destroy: jest.fn(),
    } as unknown as ReturnType<typeof import('events').EventEmitter.prototype.on>,
    stderr: {
      on: jest.fn(),
      destroy: jest.fn(),
    } as unknown as ReturnType<typeof import('events').EventEmitter.prototype.on>,
    on: jest.fn(),
    kill: jest.fn(),
    killed: false,
    pid: 12345,
  };

  // Simulate stdout data emission
  let stdoutHandler: ((chunk: Buffer) => void) | null = null;
  child.stdout.on = jest.fn((event: string, handler: (chunk: Buffer) => void) => {
    if (event === 'data') stdoutHandler = handler;
  }) as unknown as typeof child.stdout.on;

  // Trigger response emission
  const emitResponse = (response: Record<string, unknown>) => {
    if (stdoutHandler) {
      stdoutHandler(Buffer.from(JSON.stringify(response) + '\n'));
    }
  };

  // Listen for stdin writes to match requests
  child.stdin.write = jest.fn((data: string) => {
    const lines = data.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const req = JSON.parse(line);
        if (req.method === 'notifications/initialized') continue; // notification, no response needed

        const resp = pending.shift();
        if (resp) {
          // Slight delay to simulate realistic I/O
          setTimeout(() => emitResponse({ jsonrpc: '2.0', id: req.id, ...resp }), 5);
        }
      } catch {
        // ignore non-JSON
      }
    }
    return true;
  }) as unknown as jest.Mock;

  // Emit 'close' after all responses are sent
  child.on = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (event === 'close') {
      // close happens after all pending responses are consumed
      // For tests, we defer close to after responses
    }
  }) as unknown as typeof child.on;

  mockSpawn.mockReturnValue(child);
  return child;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

describe('LoopsMcpClientService', () => {
  let service: LoopsMcpClientService;
  let mockLogger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    mockSpawn = jest.fn();
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    service = new LoopsMcpClientService(mockLogger as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Transport validation
  // =========================================================================

  describe('transport validation', () => {
    it('rejects unsupported transports', async () => {
      await expect(
        service.handshake({ transport: 'sse' as never, timeoutMs: 100 }),
      ).rejects.toThrow('not yet implemented');
    });

    it('requires command for stdio transport', async () => {
      await expect(service.handshake({ transport: 'stdio', timeoutMs: 100 })).rejects.toThrow(
        'stdio transport requires `command`',
      );
    });
  });

  // =========================================================================
  // JSON-RPC protocol compliance
  // =========================================================================

  describe('JSON-RPC protocol', () => {
    it('sends proper initialize request with correct protocol version', async () => {
      const requests: string[] = [];
      const child = mockMcpServer([
        {
          result: {
            serverInfo: { name: 'test-server', version: '1.0' },
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
          },
        },
        { result: { tools: [] } },
      ]);

      // Capture writes to verify protocol
      const origWrite = child.stdin.write;
      child.stdin.write = jest.fn((data: string) => {
        requests.push(data);
        return origWrite(data);
      }) as unknown as jest.Mock;

      await service.handshake({
        transport: 'stdio',
        command: 'test-mcp',
        args: [],
        timeoutMs: 1000,
      });

      // Verify initialize request
      const initReq = JSON.parse(requests[0].split('\n')[0]);
      expect(initReq.jsonrpc).toBe('2.0');
      expect(initReq.method).toBe('initialize');
      expect(initReq.params.protocolVersion).toBe('2024-11-05');
      expect(initReq.params.clientInfo.name).toBe('dofeai-loops');

      // Verify notification was sent
      const notif = JSON.parse(requests[1].split('\n')[0]);
      expect(notif.method).toBe('notifications/initialized');
      expect(notif.id).toBeUndefined(); // notifications have no id

      // Verify tools/list request
      const toolsReq = JSON.parse(requests[2].split('\n')[0]);
      expect(toolsReq.method).toBe('tools/list');
    });

    it('handles successful handshake with tools', async () => {
      mockMcpServer([
        {
          result: {
            serverInfo: { name: 'my-mcp', version: '2.0.1' },
            protocolVersion: '2024-11-05',
            capabilities: { tools: { listChanged: true } },
          },
        },
        {
          result: {
            tools: [
              { name: 'tool-a', description: 'First tool' },
              { name: 'tool-b', description: 'Second tool', inputSchema: { type: 'object' } },
            ],
          },
        },
      ]);

      const result = await service.handshake({
        transport: 'stdio',
        command: 'mcp',
        timeoutMs: 1000,
      });

      expect(result.serverInfo).toEqual({ name: 'my-mcp', version: '2.0.1' });
      expect(result.protocolVersion).toBe('2024-11-05');
      expect(result.capabilities).toEqual({ tools: { listChanged: true } });
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].name).toBe('tool-a');
      expect(result.tools[1].inputSchema).toEqual({ type: 'object' });
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('handles empty tools list', async () => {
      mockMcpServer([
        {
          result: {
            serverInfo: { name: 'empty', version: '0.1' },
            protocolVersion: '2024-11-05',
            capabilities: {},
          },
        },
        { result: { tools: [] } },
      ]);

      const result = await service.handshake({
        transport: 'stdio',
        command: 'mcp',
        timeoutMs: 1000,
      });
      expect(result.tools).toHaveLength(0);
      expect(result.serverInfo.name).toBe('empty');
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('throws on MCP error response', async () => {
      mockMcpServer([{ error: { code: -32601, message: 'Method not found' } }]);

      await expect(
        service.handshake({ transport: 'stdio', command: 'mcp', timeoutMs: 1000 }),
      ).rejects.toThrow('MCP error -32601: Method not found');
    });

    it('throws on timeout', async () => {
      const child = mockMcpServer([
        // Never respond — will timeout
      ]);

      // Override close emission to never happen
      child.on = jest.fn();

      await expect(
        service.handshake({ transport: 'stdio', command: 'mcp', timeoutMs: 50 }),
      ).rejects.toThrow(/timed out/);
    }, 5000);

    it('throws on spawn failure', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      await expect(
        service.handshake({ transport: 'stdio', command: 'nonexistent', timeoutMs: 100 }),
      ).rejects.toThrow('ENOENT');
    });
  });

  // =========================================================================
  // Tool invocation
  // =========================================================================

  describe('tool invocation', () => {
    it('calls a tool with arguments', async () => {
      const requests: string[] = [];
      const child = mockMcpServer([
        {
          result: {
            serverInfo: { name: 'test', version: '1.0' },
            protocolVersion: '2024-11-05',
            capabilities: {},
          },
        },
        { result: { content: [{ type: 'text', text: 'Hello, World!' }] } },
      ]);

      const origWrite = child.stdin.write;
      child.stdin.write = jest.fn((data: string) => {
        requests.push(data);
        return origWrite(data);
      }) as unknown as jest.Mock;

      const result = await service.callTool(
        { transport: 'stdio', command: 'mcp', timeoutMs: 1000 },
        'echo',
        { message: 'Hello, World!' },
      );

      expect(result.toolName).toBe('echo');
      expect(result.result).toEqual({ content: [{ type: 'text', text: 'Hello, World!' }] });
      expect(result.durationMs).toBeGreaterThan(0);

      // Verify tools/call request
      const callReq = JSON.parse(requests[2].split('\n')[0]);
      expect(callReq.method).toBe('tools/call');
      expect(callReq.params.name).toBe('echo');
      expect(callReq.params.arguments).toEqual({ message: 'Hello, World!' });
    });

    it('calls a tool without arguments', async () => {
      mockMcpServer([
        {
          result: {
            serverInfo: { name: 'test', version: '1.0' },
            protocolVersion: '2024-11-05',
            capabilities: {},
          },
        },
        { result: { content: [] } },
      ]);

      const result = await service.callTool(
        { transport: 'stdio', command: 'mcp', timeoutMs: 1000 },
        'list',
      );

      expect(result.toolName).toBe('list');
      expect(result.result).toEqual({ content: [] });
    });
  });

  // =========================================================================
  // Request ID isolation
  // =========================================================================

  describe('request ID isolation', () => {
    it('starts each handshake with request ID 1', async () => {
      // First handshake
      const ids1: number[] = [];
      mockSpawn.mockImplementationOnce(() => {
        const pid = 101;
        let stdoutHandler: ((chunk: Buffer) => void) | null = null;
        const child = {
          stdin: {
            write: jest.fn((data: string) => {
              try {
                const r = JSON.parse(data.split('\n')[0]);
                if (typeof r.id === 'number') ids1.push(r.id);
              } catch {
                // ignore non-JSON lines
              }
              return true;
            }),
            end: jest.fn(),
            destroy: jest.fn(),
          },
          stdout: {
            on: jest.fn((event: string, h: (chunk: Buffer) => void) => {
              if (event === 'data') stdoutHandler = h;
            }),
            destroy: jest.fn(),
          },
          stderr: { on: jest.fn(), destroy: jest.fn() },
          on: jest.fn(),
          kill: jest.fn(),
          killed: false,
          pid,
        };
        // Emit responses after a tick
        setTimeout(() => {
          const id1 = ids1[0] ?? 1;
          const id2 = ids1[1] ?? 2;
          stdoutHandler?.(
            Buffer.from(
              JSON.stringify({
                jsonrpc: '2.0',
                id: id1,
                result: {
                  serverInfo: { name: 's1', version: '1' },
                  protocolVersion: '2024-11-05',
                  capabilities: {},
                },
              }) + '\n',
            ),
          );
          stdoutHandler?.(
            Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: id2, result: { tools: [] } }) + '\n'),
          );
        }, 5);
        return child as unknown as ReturnType<typeof mockSpawn>;
      });

      await service.handshake({ transport: 'stdio', command: 's1', timeoutMs: 2000 });
      expect(ids1[0]).toBe(1);
      expect(ids1[1]).toBe(2);

      // Second handshake — verify IDs restart from 1
      const ids2: number[] = [];
      mockSpawn.mockImplementationOnce(() => {
        let stdoutHandler: ((chunk: Buffer) => void) | null = null;
        const child = {
          stdin: {
            write: jest.fn((data: string) => {
              try {
                const r = JSON.parse(data.split('\n')[0]);
                if (typeof r.id === 'number') ids2.push(r.id);
              } catch {
                // ignore non-JSON lines
              }
              return true;
            }),
            end: jest.fn(),
            destroy: jest.fn(),
          },
          stdout: {
            on: jest.fn((event: string, h: (chunk: Buffer) => void) => {
              if (event === 'data') stdoutHandler = h;
            }),
            destroy: jest.fn(),
          },
          stderr: { on: jest.fn(), destroy: jest.fn() },
          on: jest.fn(),
          kill: jest.fn(),
          killed: false,
          pid: 102,
        };
        setTimeout(() => {
          const id1 = ids2[0] ?? 1;
          const id2 = ids2[1] ?? 2;
          stdoutHandler?.(
            Buffer.from(
              JSON.stringify({
                jsonrpc: '2.0',
                id: id1,
                result: {
                  serverInfo: { name: 's2', version: '1' },
                  protocolVersion: '2024-11-05',
                  capabilities: {},
                },
              }) + '\n',
            ),
          );
          stdoutHandler?.(
            Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: id2, result: { tools: [] } }) + '\n'),
          );
        }, 5);
        return child as unknown as ReturnType<typeof mockSpawn>;
      });

      await service.handshake({ transport: 'stdio', command: 's2', timeoutMs: 2000 });
      expect(ids2[0]).toBe(1);
      expect(ids2[1]).toBe(2);
    });
  });

  // =========================================================================
  // Process cleanup
  // =========================================================================

  describe('process cleanup', () => {
    it('kills the process after handshake', async () => {
      const child = mockMcpServer([
        {
          result: {
            serverInfo: { name: 't', version: '1' },
            protocolVersion: '2024-11-05',
            capabilities: {},
          },
        },
        { result: { tools: [] } },
      ]);

      await service.handshake({ transport: 'stdio', command: 'mcp', timeoutMs: 1000 });

      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      expect(child.stdin.end).toHaveBeenCalled();
      expect(child.stdout.destroy).toHaveBeenCalled();
      expect(child.stderr.destroy).toHaveBeenCalled();
    });

    it('force-kills on error', async () => {
      mockMcpServer([{ error: { code: -32000, message: 'Server error' } }]);

      await expect(
        service.handshake({ transport: 'stdio', command: 'mcp', timeoutMs: 1000 }),
      ).rejects.toThrow('Server error');

      // Should still cleanup
      const child = mockSpawn.mock.results[0].value;
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });
});
