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
  // @flowforge/* workspace packages are NOT external — they get bundled into the output.
  // Only third-party deps that consumers install separately are external.
  noExternal: [/@flowforge\/.*/],
  external: [
    'zod',
    'nanoid',
    'ai',
    'execa',
    'cheerio',
    'duck-duck-scrape',
    '@e2b/code-interpreter',
    'simple-git',
    'puppeteer-core',
    'pdf-parse',
    'mathjs',
    '@composio/core',
    'node:fs/promises',
    'node:path',
    'node:os',
    'node:child_process',
    'node:crypto',
  ],
});
