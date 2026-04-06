import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  action: z.enum(['parsePdf', 'parseJson', 'parseCsv', 'parseText']),
  source: z.string().describe('File path or base64-encoded content'),
  sourceType: z.enum(['file', 'base64']).default('file'),
  options: z
    .record(z.unknown())
    .optional()
    .describe(
      'Action-specific options — e.g. { delimiter: "," } for CSV, { pages: "1-5" } for PDF',
    ),
});

const outputSchema = z.object({
  data: z.unknown(),
  format: z.string(),
  success: z.boolean(),
});

const configSchema = z.object({
  allowedDirectories: z
    .array(z.string())
    .optional()
    .describe('If reading from file, paths must be within these directories'),
  maxFileSize: z
    .number()
    .int()
    .default(50_000_000)
    .describe('Maximum file size in bytes (default 50 MB)'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPathAllowed(filePath: string, allowedDirs?: string[]): boolean {
  if (!allowedDirs || allowedDirs.length === 0) return true;
  const resolved = filePath.startsWith('/') ? filePath : `${process.cwd()}/${filePath}`;
  return allowedDirs.some((dir) => resolved.startsWith(dir));
}

async function loadSource(
  source: string,
  sourceType: 'file' | 'base64',
  allowedDirs?: string[],
  maxFileSize?: number,
): Promise<Buffer> {
  if (sourceType === 'base64') {
    return Buffer.from(source, 'base64');
  }

  // File mode
  if (!isPathAllowed(source, allowedDirs)) {
    throw new Error(
      `Access denied: "${source}" is outside allowed directories [${(allowedDirs ?? []).join(', ')}]`,
    );
  }

  const fs = await import('node:fs/promises');
  const stat = await fs.stat(source);

  if (maxFileSize && stat.size > maxFileSize) {
    throw new Error(
      `File size ${stat.size} bytes exceeds the maximum allowed size of ${maxFileSize} bytes`,
    );
  }

  return fs.readFile(source);
}

function parseCsvContent(
  raw: string,
  delimiter: string,
  hasHeader: boolean,
): { headers: string[] | null; rows: string[][]; rowCount: number } {
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: null, rows: [], rowCount: 0 };
  }

  let headers: string[] | null = null;
  let dataLines = lines;

  if (hasHeader) {
    headers = (lines[0] ?? '').split(delimiter).map((h) => h.trim());
    dataLines = lines.slice(1);
  }

  const rows = dataLines.map((line) => line.split(delimiter).map((cell) => cell.trim()));

  return { headers, rows, rowCount: rows.length };
}

// ---------------------------------------------------------------------------
// Node definition
// ---------------------------------------------------------------------------

export const documentParserNode = defineNode({
  name: 'tools/document-parser',
  version: '0.1.0',
  description:
    'Parse documents — PDF, JSON, CSV, and plain text — from file paths or base64 content with directory-scoped permissions',
  category: 'custom',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['parser', 'pdf', 'csv', 'json', 'documents', 'tools', 'agentic'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const config = ctx.config as z.infer<typeof configSchema>;
    const { action, source, sourceType, options } = input;
    const { allowedDirectories, maxFileSize } = config;

    switch (action) {
      // ---------------------------------------------------------------
      // PDF
      // ---------------------------------------------------------------
      case 'parsePdf': {
        const buffer = await loadSource(source, sourceType, allowedDirectories, maxFileSize);
        // @ts-expect-error pdf-parse lacks type declarations
        const pdfParse = (await import('pdf-parse')).default;
        const pdf = await pdfParse(buffer);
        return {
          data: {
            text: pdf.text,
            pages: pdf.numpages,
            info: {
              title: pdf.info?.Title ?? null,
              author: pdf.info?.Author ?? null,
              pages: pdf.numpages,
            },
          },
          format: 'pdf',
          success: true,
        };
      }

      // ---------------------------------------------------------------
      // JSON
      // ---------------------------------------------------------------
      case 'parseJson': {
        const buffer = await loadSource(source, sourceType, allowedDirectories, maxFileSize);
        const raw = buffer.toString('utf-8');

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Invalid JSON: ${message}`);
        }

        return { data: parsed, format: 'json', success: true };
      }

      // ---------------------------------------------------------------
      // CSV
      // ---------------------------------------------------------------
      case 'parseCsv': {
        const buffer = await loadSource(source, sourceType, allowedDirectories, maxFileSize);
        const raw = buffer.toString('utf-8');
        const delimiter = (options?.delimiter as string) ?? ',';
        const hasHeader = (options?.header as boolean) ?? true;
        const result = parseCsvContent(raw, delimiter, hasHeader);
        return {
          data: { headers: result.headers, rows: result.rows, rowCount: result.rowCount },
          format: 'csv',
          success: true,
        };
      }

      // ---------------------------------------------------------------
      // Plain text (with pagination)
      // ---------------------------------------------------------------
      case 'parseText': {
        const buffer = await loadSource(source, sourceType, allowedDirectories, maxFileSize);
        const raw = buffer.toString('utf-8');
        const allLines = raw.split(/\r?\n/);

        const offset = typeof options?.offset === 'number' ? (options.offset as number) : 0;
        const limit =
          typeof options?.limit === 'number' ? (options.limit as number) : allLines.length;

        const lines = allLines.slice(offset, offset + limit);

        return {
          data: { lines, lineCount: allLines.length, offset, limit },
          format: 'text',
          success: true,
        };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
