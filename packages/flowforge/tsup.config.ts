import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    engine: 'src/engine.ts',
    nodes: 'src/nodes.ts',
    'test-utils': 'src/test-utils.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'zod',
    'ai',
    '@ai-sdk/openai',
    'execa',
    'cheerio',
    'duck-duck-scrape',
    '@e2b/code-interpreter',
    'simple-git',
    'puppeteer-core',
    'pdf-parse',
    'mathjs',
    '@composio/core',
  ],
});
