import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';
import { spawn } from 'node:child_process';

// ────────────────────────────────────────────────────────────────
// JSON-RPC types for MCP protocol
// ────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ────────────────────────────────────────────────────────────────
// MCP Connection — manages transport-level communication
// ────────────────────────────────────────────────────────────────

export class McpConnection {
  private nextId = 1;
  private transport: 'stdio' | 'sse' | 'streamable-http';
  private command?: string;
  private args?: string[];
  private url?: string;
  private env?: Record<string, string>;

  private childProcess?: ReturnType<typeof spawn>;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: JsonRpcResponse) => void;
      reject: (error: Error) => void;
    }
  >();
  private buffer = '';
  private initialized = false;

  constructor(opts: {
    transport: 'stdio' | 'sse' | 'streamable-http';
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
  }) {
    this.transport = opts.transport;
    this.command = opts.command;
    this.args = opts.args;
    this.url = opts.url;
    this.env = opts.env;
  }

  async connect(): Promise<void> {
    if (this.initialized) return;

    if (this.transport === 'stdio') {
      await this.connectStdio();
    }
    // For HTTP-based transports, no persistent connection needed

    this.initialized = true;

    // Send MCP initialize handshake
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'flowforge-mcp-client', version: '0.1.0' },
    });

    // Send initialized notification (no response expected)
    await this.sendNotification('notifications/initialized', {});
  }

  private async connectStdio(): Promise<void> {
    if (!this.command) {
      throw new Error('Command is required for stdio transport');
    }

    const child = spawn(this.command, this.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.env },
    });

    this.childProcess = child as typeof this.childProcess;

    child.stdout!.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf-8');
      this.processBuffer();
    });

    child.stderr!.on('data', (chunk: Buffer) => {
      // Log stderr but don't fail — many MCP servers emit diagnostics here
      process.stderr.write(`[mcp-server stderr] ${chunk.toString('utf-8')}`);
    });

    child.on('error', (err: Error) => {
      for (const [, pending] of this.pendingRequests) {
        pending.reject(err);
      }
      this.pendingRequests.clear();
    });

    child.on('exit', (code: number | null) => {
      const err = new Error(`MCP server process exited with code ${code}`);
      for (const [, pending] of this.pendingRequests) {
        pending.reject(err);
      }
      this.pendingRequests.clear();
      this.initialized = false;
    });
  }

  private processBuffer(): void {
    // MCP uses newline-delimited JSON-RPC messages
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg);
        }
      } catch {
        // Skip non-JSON lines (e.g. server log output)
      }
    }
  }

  async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (this.transport === 'stdio') {
      return this.sendStdioRequest(method, params);
    }
    return this.sendHttpRequest(method, params);
  }

  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    if (this.transport === 'stdio') {
      const notification = JSON.stringify({
        jsonrpc: '2.0',
        method,
        params: params ?? {},
      });
      this.childProcess?.stdin?.write(notification + '\n');
    } else {
      // For HTTP transport, fire-and-forget
      const targetUrl = this.url;
      if (!targetUrl) throw new Error('URL is required for HTTP transport');

      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params: params ?? {},
        }),
      });
    }
  }

  private sendStdioRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.childProcess?.stdin) {
        reject(new Error('MCP server process is not running'));
        return;
      }

      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params: params ?? {},
      };

      this.pendingRequests.set(id, {
        resolve: (response) => {
          if (response.error) {
            reject(new Error(`MCP error ${response.error.code}: ${response.error.message}`));
          } else {
            resolve(response.result);
          }
        },
        reject,
      });

      this.childProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  private async sendHttpRequest(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const targetUrl = this.url;
    if (!targetUrl) {
      throw new Error('URL is required for SSE/HTTP transport');
    }

    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params: params ?? {},
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`MCP HTTP request failed: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as JsonRpcResponse;

    if (result.error) {
      throw new Error(`MCP error ${result.error.code}: ${result.error.message}`);
    }

    return result.result;
  }

  async disconnect(): Promise<void> {
    if (this.childProcess) {
      this.childProcess.stdin?.end();
      this.childProcess.kill();
      this.childProcess = undefined;
    }
    this.pendingRequests.clear();
    this.initialized = false;
  }
}

// ────────────────────────────────────────────────────────────────
// Connection pool — caches connections for reuse within a workflow
// ────────────────────────────────────────────────────────────────

const connectionCache = new Map<string, McpConnection>();

function getConnectionKey(config: {
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
}): string {
  if (config.transport === 'stdio') {
    return `stdio:${config.command}:${(config.args ?? []).join(',')}`;
  }
  return `${config.transport}:${config.url}`;
}

async function getOrCreateConnection(config: {
  transport: 'stdio' | 'sse' | 'streamable-http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}): Promise<McpConnection> {
  const key = getConnectionKey(config);
  let conn = connectionCache.get(key);

  if (!conn) {
    conn = new McpConnection(config);
    await conn.connect();
    connectionCache.set(key, conn);
  }

  return conn;
}

// ────────────────────────────────────────────────────────────────
// Node definition
// ────────────────────────────────────────────────────────────────

const inputSchema = z.object({
  action: z.enum(['listTools', 'callTool', 'listResources', 'readResource']),
  toolName: z.string().optional(),
  toolArgs: z.record(z.unknown()).optional(),
  resourceUri: z.string().optional(),
});

const outputSchema = z.object({
  result: z.unknown(),
  tools: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
  resources: z.array(z.object({ uri: z.string(), name: z.string() })).optional(),
});

const configSchema = z.object({
  transport: z.enum(['stdio', 'sse', 'streamable-http']).default('stdio'),
  command: z.string().optional().describe('Command for stdio transport'),
  args: z.array(z.string()).optional().describe('Args for stdio transport'),
  url: z.string().optional().describe('URL for SSE/HTTP transport'),
  env: z.record(z.string()).optional().describe('Env vars for the MCP server process'),
});

export const mcpClientNode = defineNode({
  name: 'ai/mcp-client',
  version: '0.1.0',
  description: 'Connect to an MCP server and call its tools',
  category: 'ai',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['ai', 'mcp', 'tools', 'model-context-protocol'],

  handler: async (ctx) => {
    const { action, toolName, toolArgs, resourceUri } = ctx.input as z.infer<typeof inputSchema>;
    const {
      transport,
      command,
      args: cmdArgs,
      url,
      env,
    } = ctx.config as z.infer<typeof configSchema>;

    ctx.logger.info({ action, transport }, 'MCP client action');

    const connection = await getOrCreateConnection({
      transport,
      command,
      args: cmdArgs,
      url,
      env,
    });

    switch (action) {
      case 'listTools': {
        const response = (await connection.sendRequest('tools/list')) as {
          tools: Array<{ name: string; description: string }>;
        };
        const tools = (response.tools ?? []).map((t) => ({
          name: t.name,
          description: t.description ?? '',
        }));
        ctx.logger.info({ toolCount: tools.length }, 'Listed MCP tools');
        return { result: tools, tools };
      }

      case 'callTool': {
        if (!toolName) {
          throw new Error('toolName is required for callTool action');
        }
        ctx.logger.info({ toolName }, 'Calling MCP tool');
        const result = await connection.sendRequest('tools/call', {
          name: toolName,
          arguments: toolArgs ?? {},
        });
        return { result };
      }

      case 'listResources': {
        const response = (await connection.sendRequest('resources/list')) as {
          resources: Array<{ uri: string; name: string }>;
        };
        const resources = (response.resources ?? []).map((r) => ({
          uri: r.uri,
          name: r.name ?? '',
        }));
        ctx.logger.info({ resourceCount: resources.length }, 'Listed MCP resources');
        return { result: resources, resources };
      }

      case 'readResource': {
        if (!resourceUri) {
          throw new Error('resourceUri is required for readResource action');
        }
        ctx.logger.info({ resourceUri }, 'Reading MCP resource');
        const result = await connection.sendRequest('resources/read', {
          uri: resourceUri,
        });
        return { result };
      }

      default:
        throw new Error(`Unknown MCP action: ${action as string}`);
    }
  },
});
