import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['runReport', 'runRealtimeReport', 'runFunnelReport', 'batchRunReports']),
  propertyId: z.string().optional(),
  dimensions: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
  dateRanges: z.array(z.unknown()).optional(),
  reports: z.array(z.unknown()).optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Google Analytics integration connection identifier'),
});

export const googleAnalyticsNode = defineNode({
  name: 'communication/google-analytics',
  version: '0.1.0',
  description: 'Run reports and analyze website traffic via Google Analytics',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['analytics', 'google', 'reporting'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'runReport': {
        const { propertyId, dimensions, metrics, dateRanges } = input;
        if (!propertyId) throw new Error('propertyId is required for action "runReport"');
        const result = await ctx.integrate('google-analytics', 'runReport', {
          connectionId,
          propertyId,
          dimensions,
          metrics,
          dateRanges,
        });
        return { success: true, data: result };
      }

      case 'runRealtimeReport': {
        const { propertyId, dimensions, metrics } = input;
        if (!propertyId) throw new Error('propertyId is required for action "runRealtimeReport"');
        const result = await ctx.integrate('google-analytics', 'runRealtimeReport', {
          connectionId,
          propertyId,
          dimensions,
          metrics,
        });
        return { success: true, data: result };
      }

      case 'runFunnelReport': {
        const { propertyId, dateRanges } = input;
        if (!propertyId) throw new Error('propertyId is required for action "runFunnelReport"');
        const result = await ctx.integrate('google-analytics', 'runFunnelReport', {
          connectionId,
          propertyId,
          dateRanges,
        });
        return { success: true, data: result };
      }

      case 'batchRunReports': {
        const { propertyId, reports } = input;
        if (!propertyId) throw new Error('propertyId is required for action "batchRunReports"');
        if (!reports) throw new Error('reports is required for action "batchRunReports"');
        const result = await ctx.integrate('google-analytics', 'batchRunReports', {
          connectionId,
          propertyId,
          reports,
        });
        return { success: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
