import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockContext } from './helpers.js';
import { filesystemNode } from '../tools/filesystem.js';
import { shellNode } from '../tools/shell.js';
import { codeInterpreterNode } from '../tools/code-interpreter.js';
import { webSearchNode } from '../tools/web-search.js';
import { webScrapeNode } from '../tools/web-scrape.js';
import { gitNode } from '../tools/git.js';
import { browserNode } from '../tools/browser.js';
import { documentParserNode } from '../tools/document-parser.js';
import { mathNode } from '../tools/math.js';
import { humanApprovalNode } from '../control/human-approval.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// ════════════════════════════════════════════════════════════════
// FILESYSTEM
// ════════════════════════════════════════════════════════════════

describe('tools/filesystem', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-fs-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const cfg = () => ({ allowedDirectories: [tmpDir], readOnly: false });
  const roCfg = () => ({ allowedDirectories: [tmpDir], readOnly: true });

  it('reads a file', async () => {
    await fs.writeFile(path.join(tmpDir, 'hello.txt'), 'Hello world');
    const ctx = createMockContext({
      input: { action: 'readFile', path: path.join(tmpDir, 'hello.txt') },
      config: cfg(),
    });
    const res = (await filesystemNode.handler(ctx)) as Record<string, unknown>;
    expect(res.success).toBe(true);
    const data = res.data as Record<string, unknown>;
    expect(data.content ?? data).toContain('Hello world');
  });

  it('reads a file with offset and limit', async () => {
    await fs.writeFile(path.join(tmpDir, 'lines.txt'), 'a\nb\nc\nd\ne');
    const ctx = createMockContext({
      input: { action: 'readFile', path: path.join(tmpDir, 'lines.txt'), offset: 1, limit: 2 },
      config: cfg(),
    });
    const res = (await filesystemNode.handler(ctx)) as Record<string, unknown>;
    expect(res.success).toBe(true);
  });

  it('writes a file', async () => {
    const fp = path.join(tmpDir, 'out.txt');
    const ctx = createMockContext({
      input: { action: 'writeFile', path: fp, content: 'Written!' },
      config: cfg(),
    });
    const res = (await filesystemNode.handler(ctx)) as Record<string, unknown>;
    expect(res.success).toBe(true);
    expect(await fs.readFile(fp, 'utf-8')).toBe('Written!');
  });

  it('edits a file with search/replace', async () => {
    const fp = path.join(tmpDir, 'edit.txt');
    await fs.writeFile(fp, 'Hello world');
    const ctx = createMockContext({
      input: { action: 'editFile', path: fp, oldText: 'world', newText: 'FlowForge' },
      config: cfg(),
    });
    await filesystemNode.handler(ctx);
    expect(await fs.readFile(fp, 'utf-8')).toBe('Hello FlowForge');
  });

  it('lists directory contents', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.txt'), '');
    await fs.mkdir(path.join(tmpDir, 'sub'));
    const ctx = createMockContext({
      input: { action: 'listDirectory', path: tmpDir },
      config: roCfg(),
    });
    const res = (await filesystemNode.handler(ctx)) as { data: unknown[]; success: boolean };
    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
  });

  it('creates a directory', async () => {
    const dp = path.join(tmpDir, 'new-dir', 'nested');
    const ctx = createMockContext({
      input: { action: 'createDirectory', path: dp },
      config: cfg(),
    });
    const res = (await filesystemNode.handler(ctx)) as Record<string, unknown>;
    expect(res.success).toBe(true);
    const stat = await fs.stat(dp);
    expect(stat.isDirectory()).toBe(true);
  });

  it('copies a file', async () => {
    const src = path.join(tmpDir, 'src.txt');
    const dst = path.join(tmpDir, 'dst.txt');
    await fs.writeFile(src, 'copy me');
    const ctx = createMockContext({
      input: { action: 'copyFile', path: src, destination: dst },
      config: cfg(),
    });
    const res = (await filesystemNode.handler(ctx)) as Record<string, unknown>;
    expect(res.success).toBe(true);
    expect(await fs.readFile(dst, 'utf-8')).toBe('copy me');
  });

  it('searches files by regex pattern', async () => {
    await fs.writeFile(path.join(tmpDir, 'data.json'), '{}');
    await fs.writeFile(path.join(tmpDir, 'readme.md'), '');
    const ctx = createMockContext({
      input: { action: 'searchFiles', path: tmpDir, pattern: '\\.json$' },
      config: roCfg(),
    });
    const res = (await filesystemNode.handler(ctx)) as { data: unknown; success: boolean };
    expect(res.success).toBe(true);
  });

  it('greps file contents', async () => {
    await fs.writeFile(path.join(tmpDir, 'code.ts'), 'const x = 42;\nconst y = 99;\n');
    const ctx = createMockContext({
      input: { action: 'grep', path: tmpDir, pattern: '42', recursive: true },
      config: roCfg(),
    });
    const res = (await filesystemNode.handler(ctx)) as {
      data: Record<string, unknown>;
      success: boolean;
    };
    expect(res.success).toBe(true);
  });

  it('gets file info', async () => {
    const fp = path.join(tmpDir, 'info.txt');
    await fs.writeFile(fp, 'hello');
    const ctx = createMockContext({
      input: { action: 'fileInfo', path: fp },
      config: roCfg(),
    });
    const res = (await filesystemNode.handler(ctx)) as {
      data: Record<string, unknown>;
      success: boolean;
    };
    expect(res.success).toBe(true);
    expect(res.data.size).toBe(5);
  });

  it('deletes a file', async () => {
    const fp = path.join(tmpDir, 'bye.txt');
    await fs.writeFile(fp, 'bye');
    const ctx = createMockContext({
      input: { action: 'deleteFile', path: fp },
      config: cfg(),
    });
    await filesystemNode.handler(ctx);
    await expect(fs.access(fp)).rejects.toThrow();
  });

  it('rejects access outside allowed directories', async () => {
    const ctx = createMockContext({
      input: { action: 'readFile', path: '/etc/passwd' },
      config: cfg(),
    });
    await expect(filesystemNode.handler(ctx)).rejects.toThrow(/denied|allowed/i);
  });

  it('blocks writes in read-only mode', async () => {
    const ctx = createMockContext({
      input: { action: 'writeFile', path: path.join(tmpDir, 'x.txt'), content: 'nope' },
      config: roCfg(),
    });
    await expect(filesystemNode.handler(ctx)).rejects.toThrow(/read.only|not allowed/i);
  });

  it('moves a file', async () => {
    const src = path.join(tmpDir, 'move-src.txt');
    const dst = path.join(tmpDir, 'move-dst.txt');
    await fs.writeFile(src, 'move me');
    const ctx = createMockContext({
      input: { action: 'moveFile', path: src, destination: dst },
      config: cfg(),
    });
    await filesystemNode.handler(ctx);
    expect(await fs.readFile(dst, 'utf-8')).toBe('move me');
    await expect(fs.access(src)).rejects.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
// SHELL
// ════════════════════════════════════════════════════════════════

describe('tools/shell', () => {
  const cfg = () => ({
    blockedPatterns: ['rm\\s+-rf\\s+/'],
    maxTimeout: 10_000,
    maxOutputSize: 1_000_000,
  });

  it('runs a simple command', async () => {
    const ctx = createMockContext({
      input: { action: 'execute', command: 'echo', args: ['hello'] },
      config: cfg(),
    });
    const res = (await shellNode.handler(ctx)) as {
      stdout: string;
      exitCode: number;
      duration: number;
      success: boolean;
    };
    expect(res.success).toBe(true);
    expect(res.stdout.trim()).toBe('hello');
    expect(res.exitCode).toBe(0);
    expect(res.duration).toBeGreaterThanOrEqual(0);
  });

  it('runs a multi-line script', async () => {
    const ctx = createMockContext({
      input: { action: 'script', script: 'echo "line1"\necho "line2"', shell: 'bash' },
      config: cfg(),
    });
    const res = (await shellNode.handler(ctx)) as { stdout: string; success: boolean };
    expect(res.success).toBe(true);
    expect(res.stdout).toContain('line1');
    expect(res.stdout).toContain('line2');
  });

  it('blocks dangerous commands', async () => {
    const ctx = createMockContext({
      input: { action: 'execute', command: 'rm', args: ['-rf', '/'] },
      config: cfg(),
    });
    await expect(shellNode.handler(ctx)).rejects.toThrow(/[Bb]lock/);
  });

  it('enforces allowed commands list', async () => {
    const ctx = createMockContext({
      input: { action: 'execute', command: 'curl', args: ['http://evil.com'] },
      config: { ...cfg(), allowedCommands: ['echo', 'ls'] },
    });
    await expect(shellNode.handler(ctx)).rejects.toThrow(/allowed/i);
  });

  it('enforces working directory restrictions', async () => {
    const ctx = createMockContext({
      input: { action: 'execute', command: 'ls', cwd: '/etc' },
      config: { ...cfg(), allowedCwd: ['/tmp'] },
    });
    await expect(shellNode.handler(ctx)).rejects.toThrow(/allowed|denied/i);
  });

  it('captures stderr and non-zero exit codes', async () => {
    const ctx = createMockContext({
      input: { action: 'execute', command: 'ls', args: ['/nonexistent-dir-xyz'] },
      config: cfg(),
    });
    const res = (await shellNode.handler(ctx)) as {
      stderr: string;
      exitCode: number;
      success: boolean;
    };
    expect(res.success).toBe(false);
    expect(res.exitCode).not.toBe(0);
    expect(res.stderr).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════
// CODE INTERPRETER (requires E2B API key — mocked tests)
// ════════════════════════════════════════════════════════════════

describe('tools/code-interpreter', () => {
  it('throws without API key', async () => {
    const original = process.env.E2B_API_KEY;
    delete process.env.E2B_API_KEY;
    const ctx = createMockContext({
      input: { action: 'execute', code: 'print("hi")', language: 'python' },
      config: {},
    });
    await expect(codeInterpreterNode.handler(ctx)).rejects.toThrow('E2B API key');
    if (original) process.env.E2B_API_KEY = original;
  });

  it('has correct metadata', () => {
    expect(codeInterpreterNode.name).toBe('tools/code-interpreter');
    expect(codeInterpreterNode.tags).toContain('e2b');
    expect(codeInterpreterNode.tags).toContain('sandbox');
  });
});

// ════════════════════════════════════════════════════════════════
// WEB SEARCH
// ════════════════════════════════════════════════════════════════

describe('tools/web-search', () => {
  it('has correct metadata', () => {
    expect(webSearchNode.name).toBe('tools/web-search');
    expect(webSearchNode.tags).toContain('duckduckgo');
    expect(webSearchNode.tags).toContain('search');
  });
});

// ════════════════════════════════════════════════════════════════
// WEB SCRAPE
// ════════════════════════════════════════════════════════════════

describe('tools/web-scrape', () => {
  it('blocks disallowed domains', async () => {
    const ctx = createMockContext({
      input: { action: 'fetch', url: 'https://evil.com/page' },
      config: { allowedDomains: ['example.com'], blockedDomains: [], maxResponseSize: 5_000_000 },
    });
    await expect(webScrapeNode.handler(ctx)).rejects.toThrow(/not.*allowed|denied/i);
  });

  it('blocks blocked domains even if allowed', async () => {
    const ctx = createMockContext({
      input: { action: 'fetch', url: 'https://evil.com/page' },
      config: {
        allowedDomains: ['evil.com'],
        blockedDomains: ['evil.com'],
        maxResponseSize: 5_000_000,
      },
    });
    await expect(webScrapeNode.handler(ctx)).rejects.toThrow(/block/i);
  });

  it('rejects non-http protocols', async () => {
    const ctx = createMockContext({
      input: { action: 'fetch', url: 'ftp://files.example.com/data' },
      config: { maxResponseSize: 5_000_000 },
    });
    await expect(webScrapeNode.handler(ctx)).rejects.toThrow(/http/i);
  });

  it('has correct metadata', () => {
    expect(webScrapeNode.name).toBe('tools/web-scrape');
    expect(webScrapeNode.tags).toContain('cheerio');
  });
});

// ════════════════════════════════════════════════════════════════
// GIT
// ════════════════════════════════════════════════════════════════

describe('tools/git', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-git-'));
    // Initialize a git repo
    const { execa } = await import('execa');
    await execa('git', ['init'], { cwd: tmpDir });
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# Test');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'initial'], { cwd: tmpDir });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const cfg = () => ({ allowedDirectories: [tmpDir], readOnly: false, allowPush: false });
  const roCfg = () => ({ allowedDirectories: [tmpDir], readOnly: true, allowPush: false });

  it('gets repo status', async () => {
    const ctx = createMockContext({
      input: { action: 'status', repoPath: tmpDir },
      config: cfg(),
    });
    const res = (await gitNode.handler(ctx)) as { data: Record<string, unknown>; success: boolean };
    expect(res.success).toBe(true);
    expect(res.data).toHaveProperty('current');
  });

  it('gets log', async () => {
    const ctx = createMockContext({
      input: { action: 'log', repoPath: tmpDir, maxCount: 5 },
      config: roCfg(),
    });
    const res = (await gitNode.handler(ctx)) as { data: Record<string, unknown>; success: boolean };
    expect(res.success).toBe(true);
  });

  it('gets diff', async () => {
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# Updated');
    const ctx = createMockContext({
      input: { action: 'diff', repoPath: tmpDir },
      config: roCfg(),
    });
    const res = (await gitNode.handler(ctx)) as { data: unknown; success: boolean };
    expect(res.success).toBe(true);
  });

  it('lists branches', async () => {
    const ctx = createMockContext({
      input: { action: 'branch', repoPath: tmpDir },
      config: roCfg(),
    });
    const res = (await gitNode.handler(ctx)) as { data: Record<string, unknown>; success: boolean };
    expect(res.success).toBe(true);
    expect(res.data).toHaveProperty('current');
    expect(res.data).toHaveProperty('all');
  });

  it('adds and commits files', async () => {
    await fs.writeFile(path.join(tmpDir, 'new.txt'), 'new file');
    const addCtx = createMockContext({
      input: { action: 'add', repoPath: tmpDir, files: ['new.txt'] },
      config: cfg(),
    });
    await gitNode.handler(addCtx);

    const commitCtx = createMockContext({
      input: { action: 'commit', repoPath: tmpDir, message: 'add new file' },
      config: cfg(),
    });
    const res = (await gitNode.handler(commitCtx)) as Record<string, unknown>;
    expect(res.success).toBe(true);
  });

  it('blocks writes in read-only mode', async () => {
    const ctx = createMockContext({
      input: { action: 'commit', repoPath: tmpDir, message: 'nope' },
      config: roCfg(),
    });
    await expect(gitNode.handler(ctx)).rejects.toThrow(/read.only|not allowed/i);
  });

  it('blocks push unless allowPush is true', async () => {
    const ctx = createMockContext({
      input: { action: 'push', repoPath: tmpDir },
      config: cfg(), // allowPush: false
    });
    await expect(gitNode.handler(ctx)).rejects.toThrow(/push|not.*enabled|not allowed/i);
  });

  it('rejects repos outside allowed directories', async () => {
    const ctx = createMockContext({
      input: { action: 'status', repoPath: '/etc' },
      config: cfg(),
    });
    await expect(gitNode.handler(ctx)).rejects.toThrow(/denied|allowed/i);
  });
});

// ════════════════════════════════════════════════════════════════
// BROWSER (requires browser endpoint — metadata tests only)
// ════════════════════════════════════════════════════════════════

describe('tools/browser', () => {
  it('has correct metadata', () => {
    expect(browserNode.name).toBe('tools/browser');
    expect(browserNode.tags).toContain('puppeteer');
    expect(browserNode.tags).toContain('browser');
  });

  it('requires browser endpoint', async () => {
    const ctx = createMockContext({
      input: { action: 'navigate', url: 'https://example.com' },
      config: { headless: true, timeout: 5000 },
    });
    await expect(browserNode.handler(ctx)).rejects.toThrow(/endpoint|browser/i);
  });

  it('validates domain restrictions', async () => {
    const ctx = createMockContext({
      input: { action: 'navigate', url: 'https://evil.com' },
      config: {
        browserWSEndpoint: 'ws://localhost:9222',
        allowedDomains: ['example.com'],
        timeout: 5000,
      },
    });
    await expect(browserNode.handler(ctx)).rejects.toThrow(/allowed|denied/i);
  });
});

// ════════════════════════════════════════════════════════════════
// DOCUMENT PARSER
// ════════════════════════════════════════════════════════════════

describe('tools/document-parser', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-doc-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('parses JSON from file', async () => {
    const fp = path.join(tmpDir, 'data.json');
    await fs.writeFile(fp, JSON.stringify({ name: 'Alice', age: 30 }));
    const ctx = createMockContext({
      input: { action: 'parseJson', source: fp, sourceType: 'file' },
      config: { allowedDirectories: [tmpDir], maxFileSize: 50_000_000 },
    });
    const res = (await documentParserNode.handler(ctx)) as {
      data: unknown;
      format: string;
      success: boolean;
    };
    expect(res.success).toBe(true);
    expect(res.format).toBe('json');
    expect(res.data).toEqual({ name: 'Alice', age: 30 });
  });

  it('parses JSON from base64', async () => {
    const b64 = Buffer.from('{"x":1}').toString('base64');
    const ctx = createMockContext({
      input: { action: 'parseJson', source: b64, sourceType: 'base64' },
      config: { maxFileSize: 50_000_000 },
    });
    const res = (await documentParserNode.handler(ctx)) as { data: unknown; success: boolean };
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ x: 1 });
  });

  it('parses CSV with headers', async () => {
    const fp = path.join(tmpDir, 'data.csv');
    await fs.writeFile(fp, 'name,age\nAlice,30\nBob,25\n');
    const ctx = createMockContext({
      input: { action: 'parseCsv', source: fp, sourceType: 'file' },
      config: { allowedDirectories: [tmpDir], maxFileSize: 50_000_000 },
    });
    const res = (await documentParserNode.handler(ctx)) as {
      data: Record<string, unknown>;
      format: string;
      success: boolean;
    };
    expect(res.success).toBe(true);
    expect(res.format).toBe('csv');
    expect(res.data.rowCount).toBe(2);
    expect(res.data.headers).toEqual(['name', 'age']);
  });

  it('parses plain text with pagination', async () => {
    const fp = path.join(tmpDir, 'lines.txt');
    await fs.writeFile(fp, 'line1\nline2\nline3\nline4\nline5');
    const ctx = createMockContext({
      input: {
        action: 'parseText',
        source: fp,
        sourceType: 'file',
        options: { offset: 1, limit: 2 },
      },
      config: { allowedDirectories: [tmpDir], maxFileSize: 50_000_000 },
    });
    const res = (await documentParserNode.handler(ctx)) as {
      data: Record<string, unknown>;
      success: boolean;
    };
    expect(res.success).toBe(true);
  });

  it('rejects files outside allowed directories', async () => {
    const ctx = createMockContext({
      input: { action: 'parseJson', source: '/etc/passwd', sourceType: 'file' },
      config: { allowedDirectories: [tmpDir], maxFileSize: 50_000_000 },
    });
    await expect(documentParserNode.handler(ctx)).rejects.toThrow(/denied|allowed/i);
  });
});

// ════════════════════════════════════════════════════════════════
// MATH
// ════════════════════════════════════════════════════════════════

describe('tools/math', () => {
  it('evaluates an expression', async () => {
    const ctx = createMockContext({
      input: { action: 'evaluate', expression: '2 + 3 * 4' },
      config: { precision: 14 },
    });
    const res = (await mathNode.handler(ctx)) as { result: unknown; success: boolean };
    expect(res.success).toBe(true);
    expect(res.result).toBe(14);
  });

  it('evaluates trigonometric functions', async () => {
    const ctx = createMockContext({
      input: { action: 'evaluate', expression: 'sin(pi / 2)' },
      config: { precision: 14 },
    });
    const res = (await mathNode.handler(ctx)) as { result: unknown; success: boolean };
    expect(res.success).toBe(true);
    expect(res.result).toBeCloseTo(1, 10);
  });

  it('simplifies an expression', async () => {
    const ctx = createMockContext({
      input: { action: 'simplify', expression: 'x + x + x' },
      config: { precision: 14 },
    });
    const res = (await mathNode.handler(ctx)) as { result: unknown; success: boolean };
    expect(res.success).toBe(true);
    expect(String(res.result)).toContain('3');
  });

  it('computes a derivative', async () => {
    const ctx = createMockContext({
      input: { action: 'derivative', expression: 'x^3', variable: 'x' },
      config: { precision: 14 },
    });
    const res = (await mathNode.handler(ctx)) as { result: unknown; success: boolean };
    expect(res.success).toBe(true);
    expect(String(res.result)).toContain('x');
  });

  it('converts units', async () => {
    const ctx = createMockContext({
      input: { action: 'convert', from: '10 km', to: 'm' },
      config: { precision: 14 },
    });
    const res = (await mathNode.handler(ctx)) as {
      result: { value: number; unit: string; formatted: string };
      success: boolean;
    };
    expect(res.success).toBe(true);
    expect(res.result.value).toBeCloseTo(10000, 0);
    expect(res.result.unit).toBe('m');
  });

  it('throws for missing expression', async () => {
    const ctx = createMockContext({
      input: { action: 'evaluate' },
      config: { precision: 14 },
    });
    await expect(mathNode.handler(ctx)).rejects.toThrow(/expression.*required/i);
  });
});

// ════════════════════════════════════════════════════════════════
// HUMAN APPROVAL
// ════════════════════════════════════════════════════════════════

describe('control/human-approval', () => {
  it('auto-approves when configured', async () => {
    const emit = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext({
      input: { action: 'delete production database', details: { db: 'prod' } },
      config: { autoApprove: true, autoReject: false, defaultTimeout: 60_000 },
      emit,
    });
    const res = (await humanApprovalNode.handler(ctx)) as Record<string, unknown>;
    expect(res.approved).toBe(true);
    expect(res.approvedBy).toBe('system:auto-approve');
    expect(emit).not.toHaveBeenCalled();
  });

  it('auto-rejects when configured', async () => {
    const ctx = createMockContext({
      input: { action: 'dangerous operation' },
      config: { autoApprove: false, autoReject: true, defaultTimeout: 60_000 },
    });
    const res = (await humanApprovalNode.handler(ctx)) as Record<string, unknown>;
    expect(res.approved).toBe(false);
    expect(res.approvedBy).toBe('system:auto-reject');
  });

  it('emits approval request and waits for response', async () => {
    const emit = vi.fn().mockResolvedValue(undefined);
    const checkpoint = vi.fn().mockResolvedValue(undefined);
    const wait = vi.fn().mockResolvedValue({
      approved: true,
      approvedBy: 'alice@example.com',
      reason: 'LGTM',
    });
    const ctx = createMockContext({
      input: { action: 'deploy to prod', details: { version: '2.0' }, urgency: 'high' },
      config: { autoApprove: false, autoReject: false, defaultTimeout: 300_000 },
      emit,
      checkpoint,
      wait,
    });
    const res = (await humanApprovalNode.handler(ctx)) as Record<string, unknown>;

    expect(emit).toHaveBeenCalledWith(
      'human-approval.requested',
      expect.objectContaining({ action: 'deploy to prod', urgency: 'high' }),
    );
    expect(checkpoint).toHaveBeenCalled();
    expect(wait).toHaveBeenCalledWith('human-approval.response', expect.any(Object), 300_000);
    expect(res.approved).toBe(true);
    expect(res.approvedBy).toBe('alice@example.com');
    expect(res.originalAction).toBe('deploy to prod');
  });

  it('handles timeout as rejection', async () => {
    const emit = vi.fn().mockResolvedValue(undefined);
    const checkpoint = vi.fn().mockResolvedValue(undefined);
    const wait = vi.fn().mockRejectedValue(new Error('Timeout'));
    const ctx = createMockContext({
      input: { action: 'risky thing' },
      config: { autoApprove: false, autoReject: false, defaultTimeout: 1000 },
      emit,
      checkpoint,
      wait,
    });
    const res = (await humanApprovalNode.handler(ctx)) as Record<string, unknown>;
    expect(res.approved).toBe(false);
    expect(res.timedOut).toBe(true);
  });

  it('handles explicit rejection', async () => {
    const emit = vi.fn().mockResolvedValue(undefined);
    const checkpoint = vi.fn().mockResolvedValue(undefined);
    const wait = vi
      .fn()
      .mockResolvedValue({ approved: false, approvedBy: 'bob', reason: 'Too risky' });
    const ctx = createMockContext({
      input: { action: 'drop table' },
      config: { autoApprove: false, autoReject: false, defaultTimeout: 60_000 },
      emit,
      checkpoint,
      wait,
    });
    const res = (await humanApprovalNode.handler(ctx)) as Record<string, unknown>;
    expect(res.approved).toBe(false);
    expect(res.reason).toBe('Too risky');
  });
});
