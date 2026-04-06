import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    '@flowforge/shared',
    '@flowforge/engine',
    '@opentelemetry/api',
    '@opentelemetry/sdk-node',
    'pino',
    'bullmq',
    'ioredis',
    'pg',
    'drizzle-orm',
    'croner',
  ],
});
