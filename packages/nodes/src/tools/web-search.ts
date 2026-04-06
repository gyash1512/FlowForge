import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['search', 'searchNews', 'searchImages']),
  query: z.string().min(1, 'Search query must not be empty'),
  maxResults: z.number().int().min(1).max(30).default(5),
  region: z.string().optional(),
  safeSearch: z.enum(['strict', 'moderate', 'off']).default('moderate'),
  timeRange: z.enum(['day', 'week', 'month', 'year']).optional(),
});

const outputSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      description: z.string(),
    }),
  ),
  query: z.string(),
  resultCount: z.number(),
  success: z.boolean(),
});

const configSchema = z.object({
  maxResultsLimit: z
    .number()
    .int()
    .default(20)
    .describe('Maximum number of results allowed per query'),
});

type Input = z.infer<typeof inputSchema>;
type Config = z.infer<typeof configSchema>;

function mapSafeSearch(
  safeSearch: Input['safeSearch'],
  SafeSearchType: { STRICT: number; MODERATE: number; OFF: number },
): number {
  switch (safeSearch) {
    case 'strict':
      return SafeSearchType.STRICT;
    case 'off':
      return SafeSearchType.OFF;
    case 'moderate':
    default:
      return SafeSearchType.MODERATE;
  }
}

export const webSearchNode = defineNode({
  name: 'tools/web-search',
  version: '0.1.0',
  description: 'Search the web using DuckDuckGo — no API key required',
  category: 'custom',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['search', 'web', 'duckduckgo', 'tools', 'agentic'],

  handler: async (ctx) => {
    const input = ctx.input as Input;
    const config = ctx.config as Config;
    const { action, query, region, safeSearch } = input;

    const maxResults = Math.min(input.maxResults, config.maxResultsLimit);

    const ddg = await import('duck-duck-scrape');
    const safeSearchValue = mapSafeSearch(safeSearch, ddg.SafeSearchType);
    const searchOptions = { safeSearch: safeSearchValue, locale: region };

    switch (action) {
      case 'search': {
        const response = await ddg.search(query, searchOptions);

        const results = response.results.slice(0, maxResults).map((r) => ({
          title: r.title,
          url: r.url,
          description: r.description,
        }));

        return { results, query, resultCount: results.length, success: true };
      }

      case 'searchNews': {
        const response = await ddg.searchNews(query, searchOptions);

        const results = response.results.slice(0, maxResults).map((r) => ({
          title: r.title,
          url: r.url,
          description: r.excerpt,
        }));

        return { results, query, resultCount: results.length, success: true };
      }

      case 'searchImages': {
        const response = await ddg.searchImages(query, searchOptions);

        const results = response.results.slice(0, maxResults).map((r) => ({
          title: r.title,
          url: r.url,
          description: r.source,
        }));

        return { results, query, resultCount: results.length, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
