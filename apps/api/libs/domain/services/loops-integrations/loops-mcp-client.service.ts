import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

/**
 * R37: Lightweight MCP (Model Context Protocol) client.
 *
 * Implements the MCP JSON-RPC 2.0 protocol over stdio transport for real
 * handshake, tool listing, and tool invocation with MCP-compatible servers.
 *
 * Protocol spec: https://spec.modelcontextprotocol.io/
 *
 * Supported transports:
 *   - stdio: spawns a child process and communicates via stdin/stdout
 *   - sse:  (placeholder — HTTP SSE transport for remote MCP servers)
 *
 * MCP lifecycle:
 *   1. initialize      → client ↔ server capability negotiation
 *   2. initialized     → notification that handshake is complete
 *   3. tools/list      → discover available tools
 *   4. tools/call      → invoke a specific tool
 */

export interface McpClientOptions {
  transport: 'stdio' | 'sse';
  command?: string; // for stdio: the executable to spawn
  args?: string[]; // for stdio: command arguments
  env?: Record<string, string>;
  url?: string; // for sse: the endpoint URL
  timeoutMs?: number; // default: 10000ms per request
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpHandshakeResult {
  serverInfo: { name: string; version: string };
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  tools: McpTool[];
  durationMs: number;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

@Injectable()
export class LoopsMcpClientService {
  constructor(@Optional() @Inject(WINSTON_MODULE_PROVIDER) private readonly logger?: Logger) {}

  /**
   * Perform a full MCP handshake: initialize → tools/list.
   * Returns server info, capabilities, and available tools.
   */
  async handshake(opts: McpClientOptions): Promise<McpHandshakeResult> {
    const start = Date.now();
    const timeoutMs = opts.timeoutMs ?? 10000;

    if (opts.transport === 'stdio') {
      if (!opts.command) throw new Error('stdio transport requires `command`');
      return this.handshakeStdio(opts, timeoutMs, start);
    }

    throw new Error(`Transport "${opts.transport}" is not yet implemented`);
  }

  /**
   * Test a specific MCP tool by name with optional input.
   */
  async callTool(
    opts: McpClientOptions,
    toolName: string,
    toolInput?: Record<string, unknown>,
  ): Promise<{ toolName: string; result: unknown; durationMs: number }> {
    const start = Date.now();
    const timeoutMs = opts.timeoutMs ?? 10000;

    if (opts.transport === 'stdio') {
      return this.callToolStdio(opts, toolName, toolInput, timeoutMs, start);
    }

    throw new Error(`Transport "${opts.transport}" is not yet implemented`);
  }

  // =========================================================================
  // stdio transport
  // =========================================================================

  private async handshakeStdio(
    opts: McpClientOptions,
    timeoutMs: number,
    start: number,
  ): Promise<McpHandshakeResult> {
    const { spawn } = await import('child_process');
    const child = spawn(opts.command!, opts.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...opts.env },
    });

    const result = await this.withProcessTimeout(child, timeoutMs, async (send, receive) => {
      // 1. initialize (JSON-RPC ids must be unique within a stdio session)
      const initResp = await this.sendRequest(1, send, receive, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'dofeai-loops', version: '1.0.0' },
      });

      const serverInfo = ((initResp.result as Record<string, unknown>)?.serverInfo as {
        name: string;
        version: string;
      }) ?? { name: 'unknown', version: '0.0.0' };
      const capabilities =
        ((initResp.result as Record<string, unknown>)?.capabilities as Record<string, unknown>) ??
        {};
      const protocolVersion = String(
        (initResp.result as Record<string, unknown>)?.protocolVersion ?? 'unknown',
      );

      // 2. Send initialized notification
      send(this.buildNotification('notifications/initialized', {}));

      // 3. tools/list
      const toolsResp = await this.sendRequest(2, send, receive, 'tools/list', {});
      const tools = (toolsResp.result as { tools?: McpTool[] })?.tools ?? [];

      return { serverInfo, protocolVersion, capabilities, tools };
    });

    return { ...result, durationMs: Date.now() - start };
  }

  private async callToolStdio(
    opts: McpClientOptions,
    toolName: string,
    toolInput: Record<string, unknown> | undefined,
    timeoutMs: number,
    start: number,
  ): Promise<{ toolName: string; result: unknown; durationMs: number }> {
    const { spawn } = await import('child_process');
    const child = spawn(opts.command!, opts.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...opts.env },
    });

    const result = await this.withProcessTimeout(child, timeoutMs, async (send, receive) => {
      // Initialize first (JSON-RPC ids must be unique within a stdio session)
      await this.sendRequest(1, send, receive, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'dofeai-loops', version: '1.0.0' },
      });
      send(this.buildNotification('notifications/initialized', {}));

      // Call the tool
      const callResp = await this.sendRequest(2, send, receive, 'tools/call', {
        name: toolName,
        arguments: toolInput ?? {},
      });

      return { toolName, result: callResp.result };
    });

    return { ...result, durationMs: Date.now() - start };
  }

  // =========================================================================
  // JSON-RPC helpers
  // =========================================================================

  private buildRequest(id: number, method: string, params: Record<string, unknown>): string {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    return JSON.stringify(req) + '\n';
  }

  private buildNotification(method: string, params: Record<string, unknown>): string {
    const req = { jsonrpc: '2.0' as const, method, params };
    return JSON.stringify(req) + '\n';
  }

  private async sendRequest(
    id: number,
    send: (data: string) => void,
    receive: () => AsyncIterable<string>,
    method: string,
    params: Record<string, unknown>,
  ): Promise<JsonRpcResponse> {
    // Per-request timeout is enforced by the idle-timeout in receiveLines()
    // (see withProcessTimeout); this helper only handles request/response framing.
    const requestStr = this.buildRequest(id, method, params);
    send(requestStr);

    for await (const line of receive()) {
      try {
        const response: JsonRpcResponse = JSON.parse(line);
        if (response.id === id) {
          if (response.error) {
            throw new Error(`MCP error ${response.error.code}: ${response.error.message}`);
          }
          return response;
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
    throw new Error(`MCP request "${method}" failed: process closed before response`);
  }

  // =========================================================================
  // Process management
  // =========================================================================

  private async withProcessTimeout<T>(
    child: ReturnType<typeof import('child_process').spawn>,
    timeoutMs: number,
    fn: (send: (data: string) => void, receive: () => AsyncIterable<string>) => Promise<T>,
  ): Promise<T> {
    // Async generator that reads stdout lines
    const stdoutLines: string[] = [];
    let stdoutDone = false;

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      // Split by newlines, buffer incomplete lines
      const lines = text.split('\n');
      for (const line of lines) stdoutLines.push(line);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      this.logger?.debug(`[McpClient] stderr: ${chunk.toString('utf8').slice(0, 200)}`);
    });

    async function* receiveLines(): AsyncIterable<string> {
      let idx = 0;
      let lastDataMs = Date.now();
      while (!stdoutDone) {
        if (idx < stdoutLines.length) {
          const line = stdoutLines[idx++];
          lastDataMs = Date.now();
          if (line.trim()) yield line;
        } else {
          // Check if we've been idle too long (no new stdout data)
          if (Date.now() - lastDataMs > timeoutMs) {
            throw new Error(`MCP operation timed out after ${timeoutMs}ms idle`);
          }
          // Small delay to let more data arrive
          await new Promise((r) => setTimeout(r, 5));
        }
      }
      // Yield remaining lines
      while (idx < stdoutLines.length) {
        const line = stdoutLines[idx++];
        if (line.trim()) yield line;
      }
    }

    const send = (data: string) => {
      child.stdin?.write(data);
    };

    try {
      const result = await fn(send, receiveLines);
      stdoutDone = true;
      child.kill('SIGTERM');
      return result;
    } catch (error) {
      stdoutDone = true;
      child.kill('SIGTERM');
      throw error;
    } finally {
      // Ensure process is cleaned up
      if (!child.killed) {
        child.kill('SIGKILL');
      }
      child.stdin?.end();
      child.stdout?.destroy();
      child.stderr?.destroy();
    }
  }

  log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    this.logger?.[level](`[McpClient] ${message}`, meta);
  }
}
