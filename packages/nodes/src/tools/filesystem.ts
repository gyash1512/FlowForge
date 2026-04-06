import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

const inputSchema = z.object({
  action: z.enum([
    'readFile',
    'writeFile',
    'editFile',
    'listDirectory',
    'searchFiles',
    'fileInfo',
    'moveFile',
    'copyFile',
    'deleteFile',
    'createDirectory',
    'grep',
  ]),
  path: z.string().describe('Target file or directory path'),
  content: z.string().optional().describe('File content for writeFile'),
  oldText: z.string().optional().describe('Text to find for editFile'),
  newText: z.string().optional().describe('Replacement text for editFile'),
  pattern: z.string().optional().describe('Regex pattern for searchFiles / grep'),
  destination: z.string().optional().describe('Destination path for moveFile / copyFile'),
  recursive: z.boolean().optional().describe('Recurse into subdirectories'),
  encoding: z.string().optional().describe('File encoding (default: utf-8)'),
  offset: z.number().int().min(0).optional().describe('Line offset for readFile (0-based)'),
  limit: z.number().int().positive().optional().describe('Max lines to return for readFile'),
  filePattern: z.string().optional().describe('Glob pattern to filter files for grep (e.g. *.ts)'),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  allowedDirectories: z
    .array(z.string())
    .describe('Directories the node is allowed to access — paths outside these are rejected'),
  readOnly: z.boolean().default(false).describe('If true, only read operations are allowed'),
});

// ────────────────────────────────────────────────────────────────
// Security helpers
// ────────────────────────────────────────────────────────────────

/** Actions that mutate the filesystem. */
const WRITE_ACTIONS = new Set([
  'writeFile',
  'editFile',
  'moveFile',
  'copyFile',
  'deleteFile',
  'createDirectory',
]);

/**
 * Resolve a path and verify it falls within one of the allowed directories.
 * Blocks path-traversal attempts by resolving `..` segments before comparison.
 */
function assertPathAllowed(
  rawPath: string,
  allowedDirs: string[],
  resolve: (p: string) => string,
): string {
  const resolved = resolve(rawPath);

  if (resolved.includes('..')) {
    throw new Error(`Path traversal detected: "${rawPath}"`);
  }

  const allowed = allowedDirs.some((dir) => {
    const resolvedDir = resolve(dir);
    return resolved === resolvedDir || resolved.startsWith(resolvedDir + '/');
  });

  if (!allowed) {
    throw new Error(
      `Access denied: "${resolved}" is outside allowed directories [${allowedDirs.join(', ')}]`,
    );
  }

  return resolved;
}

// ────────────────────────────────────────────────────────────────
// Node definition
// ────────────────────────────────────────────────────────────────

export const filesystemNode = defineNode({
  name: 'tools/filesystem',
  version: '0.1.0',
  description:
    'Read, write, edit, search, grep, and manage files with directory-scoped permissions',
  category: 'custom',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['filesystem', 'files', 'read', 'write', 'tools', 'agentic'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const config = ctx.config as z.infer<typeof configSchema>;
    const { action } = input;
    const { allowedDirectories, readOnly } = config;

    // Dynamic imports — keeps the module lightweight when not in use.
    const fs = await import('node:fs/promises');
    const nodePath = await import('node:path');
    const resolve = (p: string) => nodePath.resolve(p);

    // ── Permission checks ──────────────────────────────────────
    const resolvedPath = assertPathAllowed(input.path, allowedDirectories, resolve);

    if (readOnly && WRITE_ACTIONS.has(action)) {
      throw new Error(`Action "${action}" is not allowed in read-only mode`);
    }

    // ── Action dispatch ────────────────────────────────────────
    switch (action) {
      // ── readFile ─────────────────────────────────────────────
      case 'readFile': {
        ctx.logger.info(`readFile: ${resolvedPath}`);
        const encoding = (input.encoding ?? 'utf-8') as BufferEncoding;
        const raw = await fs.readFile(resolvedPath, { encoding });

        if (input.offset !== undefined || input.limit !== undefined) {
          const lines = raw.split('\n');
          const start = input.offset ?? 0;
          const end = input.limit !== undefined ? start + input.limit : lines.length;
          const slice = lines.slice(start, end);
          return {
            data: {
              content: slice.join('\n'),
              totalLines: lines.length,
              offset: start,
              linesReturned: slice.length,
            },
            success: true,
          };
        }

        return { data: { content: raw }, success: true };
      }

      // ── writeFile ────────────────────────────────────────────
      case 'writeFile': {
        if (input.content === undefined) {
          throw new Error('content is required for action "writeFile"');
        }
        ctx.logger.info(`writeFile: ${resolvedPath}`);
        const dir = nodePath.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolvedPath, input.content, { encoding: 'utf-8' });
        return { data: { written: resolvedPath }, success: true };
      }

      // ── editFile ─────────────────────────────────────────────
      case 'editFile': {
        if (!input.oldText) {
          throw new Error('oldText is required for action "editFile"');
        }
        if (input.newText === undefined) {
          throw new Error('newText is required for action "editFile"');
        }
        ctx.logger.info(`editFile: ${resolvedPath}`);
        const existing = await fs.readFile(resolvedPath, 'utf-8');
        if (!existing.includes(input.oldText)) {
          throw new Error('oldText not found in file');
        }
        const updated = existing.replace(input.oldText, input.newText);
        await fs.writeFile(resolvedPath, updated, 'utf-8');
        return { data: { edited: resolvedPath }, success: true };
      }

      // ── listDirectory ────────────────────────────────────────
      case 'listDirectory': {
        ctx.logger.info(`listDirectory: ${resolvedPath}`);
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const items = entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'symlink' : 'file',
        }));
        return { data: items, success: true };
      }

      // ── searchFiles (recursive file-name search) ─────────────
      case 'searchFiles': {
        if (!input.pattern) {
          throw new Error('pattern is required for action "searchFiles"');
        }
        ctx.logger.info(`searchFiles: pattern="${input.pattern}" in ${resolvedPath}`);
        const regex = new RegExp(input.pattern);
        const results: string[] = [];

        async function walk(dir: string): Promise<void> {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = nodePath.join(dir, entry.name);
            if (entry.isDirectory()) {
              await walk(full);
            } else if (regex.test(entry.name)) {
              results.push(full);
            }
          }
        }

        await walk(resolvedPath);
        return { data: results, success: true };
      }

      // ── fileInfo ─────────────────────────────────────────────
      case 'fileInfo': {
        ctx.logger.info(`fileInfo: ${resolvedPath}`);
        const stat = await fs.stat(resolvedPath);
        return {
          data: {
            path: resolvedPath,
            size: stat.size,
            isFile: stat.isFile(),
            isDirectory: stat.isDirectory(),
            isSymlink: stat.isSymbolicLink(),
            permissions: stat.mode.toString(8),
            modified: stat.mtime.toISOString(),
            created: stat.birthtime.toISOString(),
            accessed: stat.atime.toISOString(),
          },
          success: true,
        };
      }

      // ── moveFile ─────────────────────────────────────────────
      case 'moveFile': {
        if (!input.destination) {
          throw new Error('destination is required for action "moveFile"');
        }
        const resolvedDest = assertPathAllowed(input.destination, allowedDirectories, resolve);
        ctx.logger.info(`moveFile: ${resolvedPath} → ${resolvedDest}`);
        const destDir = nodePath.dirname(resolvedDest);
        await fs.mkdir(destDir, { recursive: true });
        await fs.rename(resolvedPath, resolvedDest);
        return { data: { moved: { from: resolvedPath, to: resolvedDest } }, success: true };
      }

      // ── copyFile ─────────────────────────────────────────────
      case 'copyFile': {
        if (!input.destination) {
          throw new Error('destination is required for action "copyFile"');
        }
        const resolvedCopyDest = assertPathAllowed(input.destination, allowedDirectories, resolve);
        ctx.logger.info(`copyFile: ${resolvedPath} → ${resolvedCopyDest}`);
        const copyDestDir = nodePath.dirname(resolvedCopyDest);
        await fs.mkdir(copyDestDir, { recursive: true });
        await fs.copyFile(resolvedPath, resolvedCopyDest);
        return {
          data: { copied: { from: resolvedPath, to: resolvedCopyDest } },
          success: true,
        };
      }

      // ── deleteFile ───────────────────────────────────────────
      case 'deleteFile': {
        ctx.logger.info(`deleteFile: ${resolvedPath}`);
        await fs.rm(resolvedPath, { recursive: input.recursive ?? false });
        return { data: { deleted: resolvedPath }, success: true };
      }

      // ── createDirectory ──────────────────────────────────────
      case 'createDirectory': {
        ctx.logger.info(`createDirectory: ${resolvedPath}`);
        await fs.mkdir(resolvedPath, { recursive: true });
        return { data: { created: resolvedPath }, success: true };
      }

      // ── grep ─────────────────────────────────────────────────
      case 'grep': {
        if (!input.pattern) {
          throw new Error('pattern is required for action "grep"');
        }
        ctx.logger.info(
          `grep: pattern="${input.pattern}" in ${resolvedPath} (recursive=${input.recursive ?? true})`,
        );
        const grepRegex = new RegExp(input.pattern);
        const recursive = input.recursive ?? true;
        const filePattern = input.filePattern
          ? new RegExp(
              input.filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.'),
            )
          : null;

        interface GrepMatch {
          file: string;
          line: number;
          content: string;
        }
        const matches: GrepMatch[] = [];

        async function grepFile(filePath: string): Promise<void> {
          const text = await fs.readFile(filePath, 'utf-8');
          const lines = text.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? '';
            if (grepRegex.test(line)) {
              matches.push({ file: filePath, line: i + 1, content: line });
            }
          }
        }

        async function grepDir(dir: string): Promise<void> {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = nodePath.join(dir, entry.name);
            if (entry.isDirectory() && recursive) {
              await grepDir(full);
            } else if (entry.isFile()) {
              if (filePattern && !filePattern.test(entry.name)) {
                continue;
              }
              await grepFile(full);
            }
          }
        }

        // If path is a file, grep it directly; otherwise walk the directory.
        const stat = await fs.stat(resolvedPath);
        if (stat.isFile()) {
          await grepFile(resolvedPath);
        } else {
          await grepDir(resolvedPath);
        }

        return { data: { matches, totalMatches: matches.length }, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
