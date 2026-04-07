import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  action: z.enum(['navigate', 'screenshot', 'click', 'type', 'evaluate', 'extractText', 'pdf']),
  url: z.string().optional(),
  selector: z.string().optional(),
  text: z.string().optional(),
  script: z.string().optional(),
  waitForSelector: z.string().optional(),
  fullPage: z.boolean().default(true),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  browserWSEndpoint: z
    .string()
    .optional()
    .describe('WebSocket endpoint to connect to an existing browser instance'),
  allowedDomains: z
    .array(z.string())
    .optional()
    .describe('If set, only these domains may be visited'),
  headless: z.boolean().default(true),
  timeout: z.number().int().default(30_000).describe('Default timeout in milliseconds'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateUrl(url: string, allowedDomains?: string[]): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: "${url}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Only http and https protocols are allowed, got "${parsed.protocol}"`);
  }

  if (allowedDomains && allowedDomains.length > 0) {
    const hostname = parsed.hostname;
    const isAllowed = allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    if (!isAllowed) {
      throw new Error(
        `Domain "${hostname}" is not in the allowed list: [${allowedDomains.join(', ')}]`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Node definition
// ---------------------------------------------------------------------------

export const browserNode = defineNode({
  name: 'tools/browser',
  version: '0.1.0',
  description:
    'Automate a browser — navigate, screenshot, click, type, evaluate JS, extract text, and generate PDFs via Puppeteer',
  category: 'custom',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['browser', 'puppeteer', 'automation', 'scraping', 'tools', 'agentic'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const config = ctx.config as z.infer<typeof configSchema>;
    const { action, waitForSelector } = input;
    const { browserWSEndpoint, allowedDomains, timeout } = config;

    // --- Validate URL early (before connecting to browser) ---
    if (input.url) {
      validateUrl(input.url, allowedDomains);
    }

    // --- Require a browser endpoint (puppeteer-core doesn't bundle a browser) ---
    if (!browserWSEndpoint) {
      throw new Error(
        'A browserWSEndpoint is required — puppeteer-core does not bundle a browser. ' +
          'Provide a WebSocket endpoint to an existing browser instance.',
      );
    }

    // --- Dynamic import ---
    const puppeteer = await import('puppeteer-core');

    const browser = await puppeteer.connect({ browserWSEndpoint });
    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);

    try {
      // --- Wait for selector if specified ---
      async function waitIfRequested(): Promise<void> {
        if (waitForSelector) {
          await page.waitForSelector(waitForSelector, { timeout });
        }
      }

      switch (action) {
        // ---------------------------------------------------------------
        // Navigation
        // ---------------------------------------------------------------
        case 'navigate': {
          if (!input.url) throw new Error('url is required for action "navigate"');
          validateUrl(input.url, allowedDomains);
          await page.goto(input.url, { waitUntil: 'networkidle2', timeout });
          await waitIfRequested();
          const title = await page.title();
          const currentUrl = page.url();
          return { data: { title, url: currentUrl }, success: true };
        }

        // ---------------------------------------------------------------
        // Screenshot
        // ---------------------------------------------------------------
        case 'screenshot': {
          await waitIfRequested();
          const buffer = await page.screenshot({
            fullPage: input.fullPage,
            encoding: 'base64',
          });
          return { data: { image: buffer }, success: true };
        }

        // ---------------------------------------------------------------
        // Click
        // ---------------------------------------------------------------
        case 'click': {
          if (!input.selector) throw new Error('selector is required for action "click"');
          await waitIfRequested();
          await page.click(input.selector);
          return { data: { clicked: input.selector }, success: true };
        }

        // ---------------------------------------------------------------
        // Type
        // ---------------------------------------------------------------
        case 'type': {
          if (!input.selector) throw new Error('selector is required for action "type"');
          if (input.text === undefined) throw new Error('text is required for action "type"');
          await waitIfRequested();
          await page.type(input.selector, input.text);
          return { data: { typed: input.selector }, success: true };
        }

        // ---------------------------------------------------------------
        // Evaluate JS
        // ---------------------------------------------------------------
        case 'evaluate': {
          if (!input.script) throw new Error('script is required for action "evaluate"');
          await waitIfRequested();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const result = await page.evaluate(input.script);
          return { data: { result }, success: true };
        }

        // ---------------------------------------------------------------
        // Extract text
        // ---------------------------------------------------------------
        case 'extractText': {
          await waitIfRequested();
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          const text = await page.evaluate('document.body.innerText');
          return { data: { text }, success: true };
        }

        // ---------------------------------------------------------------
        // Generate PDF
        // ---------------------------------------------------------------
        case 'pdf': {
          await waitIfRequested();
          const pdfBuffer = await page.pdf({ format: 'A4' });
          const base64 = Buffer.from(pdfBuffer).toString('base64');
          return { data: { pdf: base64 }, success: true };
        }

        default:
          throw new Error(`Unknown action: ${action as string}`);
      }
    } finally {
      await page.close();
    }
  },
});
