import { Hono } from 'hono';
import type { MetricsSnapshot } from '@flowforgejs/shared';
import { RunStatus } from '@flowforgejs/shared';
import { getRunStore } from './runs.js';

export const metricsRoutes = new Hono();

/** GET /api/metrics - aggregated metrics */
metricsRoutes.get('/', (c) => {
  const query = c.req.query();
  const period = query['period'] ?? '24h';
  const runs = [...getRunStore().values()];

  const periodMs = parsePeriod(period);
  const cutoff = new Date(Date.now() - periodMs);
  const filteredRuns = runs.filter((r) => r.createdAt >= cutoff);

  const totalRuns = filteredRuns.length;
  const successCount = filteredRuns.filter((r) => r.status === RunStatus.COMPLETED).length;
  const failureCount = filteredRuns.filter((r) => r.status === RunStatus.FAILED).length;

  const durations = filteredRuns
    .filter((r) => r.startedAt && r.completedAt)
    .map((r) => r.completedAt!.getTime() - r.startedAt!.getTime());

  const avgDurationMs =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedDurations.length * 0.95);
  const p95DurationMs = sortedDurations[p95Index] ?? 0;

  const periodHours = periodMs / (1000 * 60 * 60);
  const throughputPerHour = periodHours > 0 ? totalRuns / periodHours : 0;

  const snapshot: MetricsSnapshot = {
    totalRuns,
    successCount,
    failureCount,
    avgDurationMs: Math.round(avgDurationMs),
    p95DurationMs,
    throughputPerHour: Math.round(throughputPerHour * 100) / 100,
    period,
  };

  return c.json(snapshot);
});

function parsePeriod(period: string): number {
  const match = period.match(/^(\d+)(h|d|m)$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}
