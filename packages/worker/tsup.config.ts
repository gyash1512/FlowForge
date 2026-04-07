import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    '@flowforgejs/shared',
    '@flowforgejs/engine',
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
