import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['fetch', 'extract', 'extractLinks', 'extractMetadata']),
  url: z.string().url(),
  selector: z.string().optional(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().positive().default(30_000),
  userAgent: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  url: z.string(),
  success: z.boolean(),
});

const configSchema = z.object({
  allowedDomains: z
    .array(z.string())
    .optional()
    .describe('If set, only these domains can be fetched'),
  blockedDomains: z.array(z.string()).default([]).describe('Domains that are always blocked'),
  maxResponseSize: z
    .number()
    .int()
    .default(5_000_000)
    .describe('Max response size in bytes (default 5MB)'),
});

type Input = z.infer<typeof inputSchema>;
type Config = z.infer<typeof configSchema>;

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function validateUrl(url: string, config: Config): void {
  const parsed = new URL(url);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid protocol "${parsed.protocol}" — only http and https are allowed`);
  }

  const hostname = parsed.hostname;

  if (config.blockedDomains.some((d) => matchesDomain(hostname, d))) {
    throw new Error(`Domain "${hostname}" is blocked`);
  }

  if (
    config.allowedDomains &&
    config.allowedDomains.length > 0 &&
    !config.allowedDomains.some((d) => matchesDomain(hostname, d))
  ) {
    throw new Error(
      `Domain "${hostname}" is not in allowed domains: [${config.allowedDomains.join(', ')}]`,
    );
  }
}

export const webScrapeNode = defineNode({
  name: 'tools/web-scrape',
  version: '0.1.0',
  description:
    'Fetch web pages and extract content, text, links, or metadata using Cheerio — with domain restrictions',
  category: 'custom',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['scrape', 'web', 'html', 'cheerio', 'tools', 'agentic'],

  handler: async (ctx) => {
    const input = ctx.input as Input;
    const config = ctx.config as Config;
    const { action, url, selector, headers, timeout, userAgent } = input;

    validateUrl(url, config);

    const reqHeaders: Record<string, string> = {
      'User-Agent': userAgent ?? 'FlowForge-Bot/1.0 (compatible; workflow automation)',
      ...headers,
    };

    const response = await fetch(url, {
      headers: reqHeaders,
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > config.maxResponseSize) {
      throw new Error(
        `Response too large (${contentLength} bytes > ${config.maxResponseSize} max)`,
      );
    }

    const html = await response.text();
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);

    switch (action) {
      case 'fetch': {
        $('script, style, nav, footer, header, noscript, iframe').remove();

        const text = $('body').text().replace(/\s+/g, ' ').trim();

        return { data: { content: text }, url, success: true };
      }

      case 'extract': {
        if (!selector) {
          throw new Error('selector is required for action "extract"');
        }

        const elements = $(selector)
          .map((_, el) => {
            const $el = $(el);
            return {
              text: $el.text().trim(),
              html: $el.html(),
              attributes: Object.fromEntries(Object.entries($el.attr() ?? {})),
            };
          })
          .get();

        return { data: { elements }, url, success: true };
      }

      case 'extractLinks': {
        $('script, style, nav, footer, header, noscript, iframe').remove();

        const baseUrl = new URL(url);
        const links = $('a[href]')
          .map((_, el) => {
            const href = $(el).attr('href');
            if (!href) return null;
            try {
              const absolute = new URL(href, baseUrl).toString();
              return { text: $(el).text().trim(), url: absolute };
            } catch {
              return null;
            }
          })
          .get()
          .filter(Boolean);

        return { data: { links }, url, success: true };
      }

      case 'extractMetadata': {
        const title = $('title').first().text().trim() || undefined;
        const metaDescription = $('meta[name="description"]').attr('content') || undefined;
        const ogTitle = $('meta[property="og:title"]').attr('content') || undefined;
        const ogDescription = $('meta[property="og:description"]').attr('content') || undefined;
        const ogImage = $('meta[property="og:image"]').attr('content') || undefined;
        const canonical = $('link[rel="canonical"]').attr('href') || undefined;

        return {
          data: {
            title,
            metaDescription,
            ogTitle,
            ogDescription,
            ogImage,
            canonical,
          },
          url,
          success: true,
        };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
