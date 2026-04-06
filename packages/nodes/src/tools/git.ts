import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  action: z.enum([
    'clone',
    'status',
    'diff',
    'log',
    'commit',
    'branch',
    'checkout',
    'add',
    'push',
    'pull',
    'stash',
    'tag',
  ]),
  repoPath: z.string(),
  url: z.string().optional(),
  message: z.string().optional(),
  files: z.array(z.string()).optional(),
  branch: z.string().optional(),
  remote: z.string().default('origin'),
  maxCount: z.number().int().positive().optional(),
  tagName: z.string().optional(),
  stashAction: z.enum(['save', 'pop', 'list']).optional(),
  staged: z.boolean().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  allowedDirectories: z
    .array(z.string())
    .describe('Repositories must reside within these directories'),
  readOnly: z
    .boolean()
    .default(false)
    .describe('If true, only status, diff, log, and branch (list) are allowed'),
  allowPush: z.boolean().default(false).describe('Push must be explicitly enabled'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPathAllowed(repoPath: string, allowedDirs: string[]): boolean {
  const resolved = repoPath.startsWith('/') ? repoPath : `${process.cwd()}/${repoPath}`;
  return allowedDirs.some((dir) => resolved.startsWith(dir));
}

const READ_ONLY_ACTIONS = new Set(['status', 'diff', 'log', 'branch']);
const WRITE_ACTIONS = new Set(['clone', 'commit', 'checkout', 'add', 'pull', 'stash', 'tag']);

// ---------------------------------------------------------------------------
// Node definition
// ---------------------------------------------------------------------------

export const gitNode = defineNode({
  name: 'tools/git',
  version: '0.1.0',
  description:
    'Perform Git operations — clone, status, diff, log, commit, branch, checkout, add, push, pull, stash, and tag — with directory-scoped permissions and safety controls',
  category: 'custom',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['git', 'version-control', 'scm', 'tools', 'agentic'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const config = ctx.config as z.infer<typeof configSchema>;
    const { action, repoPath } = input;
    const { allowedDirectories, readOnly, allowPush } = config;

    // --- Security: path validation ---
    if (!isPathAllowed(repoPath, allowedDirectories)) {
      throw new Error(
        `Access denied: "${repoPath}" is outside allowed directories [${allowedDirectories.join(', ')}]`,
      );
    }

    // --- Security: read-only guard ---
    if (readOnly && !READ_ONLY_ACTIONS.has(action)) {
      throw new Error(`Action "${action}" is not allowed in read-only mode`);
    }

    // --- Security: push guard ---
    if (action === 'push' && !allowPush) {
      throw new Error('Push is disabled — set allowPush to true in config to enable');
    }

    // --- Dynamic import ---
    const { simpleGit } = await import('simple-git');
    const git = simpleGit(repoPath);

    switch (action) {
      // ---------------------------------------------------------------
      // Read operations
      // ---------------------------------------------------------------
      case 'status': {
        const status = await git.status();
        return {
          data: {
            current: status.current,
            tracking: status.tracking,
            files: status.files.map((f) => ({ path: f.path, status: f.working_dir || f.index })),
          },
          success: true,
        };
      }

      case 'diff': {
        const args = input.staged ? ['--staged'] : [];
        const diff = await git.diff(args);
        return { data: { diff }, success: true };
      }

      case 'log': {
        const maxCount = input.maxCount ?? 20;
        const log = await git.log({ maxCount });
        const commits = log.all.map((c) => ({
          hash: c.hash,
          message: c.message,
          date: c.date,
          author: c.author_name,
        }));
        return { data: { commits }, success: true };
      }

      case 'branch': {
        const branches = await git.branch();
        return {
          data: { current: branches.current, all: branches.all },
          success: true,
        };
      }

      // ---------------------------------------------------------------
      // Write operations
      // ---------------------------------------------------------------
      case 'clone': {
        if (!input.url) throw new Error('url is required for action "clone"');
        await git.clone(input.url, repoPath);
        return { data: { cloned: input.url, to: repoPath }, success: true };
      }

      case 'add': {
        const files = input.files ?? ['.'];
        await git.add(files);
        return { data: { added: files }, success: true };
      }

      case 'commit': {
        if (!input.message) throw new Error('message is required for action "commit"');
        const result = await git.commit(input.message);
        return {
          data: { hash: result.commit, summary: { changes: result.summary.changes } },
          success: true,
        };
      }

      case 'checkout': {
        if (!input.branch) throw new Error('branch is required for action "checkout"');
        await git.checkout(input.branch);
        return { data: { checkedOut: input.branch }, success: true };
      }

      case 'push': {
        const remote = input.remote;
        const branch = input.branch;
        if (branch) {
          await git.push(remote, branch);
        } else {
          await git.push(remote);
        }
        return { data: { pushed: { remote, branch: branch ?? 'current' } }, success: true };
      }

      case 'pull': {
        const remote = input.remote;
        const branch = input.branch;
        const pullResult = branch ? await git.pull(remote, branch) : await git.pull(remote);
        return {
          data: {
            summary: {
              changes: pullResult.summary.changes,
              insertions: pullResult.summary.insertions,
              deletions: pullResult.summary.deletions,
            },
          },
          success: true,
        };
      }

      case 'stash': {
        const stashAction = input.stashAction ?? 'save';
        switch (stashAction) {
          case 'save': {
            const msg = input.message;
            if (msg) {
              await git.stash(['save', msg]);
            } else {
              await git.stash(['save']);
            }
            return { data: { stash: 'saved' }, success: true };
          }
          case 'pop': {
            await git.stash(['pop']);
            return { data: { stash: 'popped' }, success: true };
          }
          case 'list': {
            const list = await git.stashList();
            return {
              data: {
                stashes: list.all.map((s) => ({
                  hash: s.hash,
                  message: s.message,
                  date: s.date,
                })),
              },
              success: true,
            };
          }
          default:
            throw new Error(`Unknown stash action: ${stashAction as string}`);
        }
      }

      case 'tag': {
        if (!input.tagName) throw new Error('tagName is required for action "tag"');
        const msg = input.message;
        if (msg) {
          await git.addAnnotatedTag(input.tagName, msg);
        } else {
          await git.addTag(input.tagName);
        }
        return { data: { tagged: input.tagName }, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
