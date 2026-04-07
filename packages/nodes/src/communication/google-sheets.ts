import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['createRow', 'lookupRow', 'getValues', 'updateValues', 'createSheet']),
  spreadsheetId: z.string().optional(),
  sheetName: z.string().optional(),
  range: z.string().optional(),
  values: z.array(z.unknown()).optional(),
  row: z.record(z.unknown()).optional(),
  lookupColumn: z.string().optional(),
  lookupValue: z.string().optional(),
  title: z.string().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Google Sheets integration connection identifier'),
});

export const googleSheetsNode = defineNode({
  name: 'communication/google-sheets',
  version: '0.1.0',
  description: 'Create rows, look up data, and manage spreadsheets via Google Sheets',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['google', 'sheets', 'spreadsheet'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createRow': {
        const { spreadsheetId, sheetName, row } = input;
        if (!spreadsheetId) throw new Error('spreadsheetId is required for action "createRow"');
        if (!sheetName) throw new Error('sheetName is required for action "createRow"');
        if (!row) throw new Error('row is required for action "createRow"');
        const result = await ctx.integrate('google-sheets', 'createRow', {
          connectionId,
          spreadsheetId,
          sheetName,
          row,
        });
        return { success: true, data: result };
      }

      case 'lookupRow': {
        const { spreadsheetId, sheetName, lookupColumn, lookupValue } = input;
        if (!spreadsheetId) throw new Error('spreadsheetId is required for action "lookupRow"');
        if (!sheetName) throw new Error('sheetName is required for action "lookupRow"');
        if (!lookupColumn) throw new Error('lookupColumn is required for action "lookupRow"');
        if (!lookupValue) throw new Error('lookupValue is required for action "lookupRow"');
        const result = await ctx.integrate('google-sheets', 'lookupRow', {
          connectionId,
          spreadsheetId,
          sheetName,
          lookupColumn,
          lookupValue,
        });
        return { success: true, data: result };
      }

      case 'getValues': {
        const { spreadsheetId, range } = input;
        if (!spreadsheetId) throw new Error('spreadsheetId is required for action "getValues"');
        if (!range) throw new Error('range is required for action "getValues"');
        const result = await ctx.integrate('google-sheets', 'getValues', {
          connectionId,
          spreadsheetId,
          range,
        });
        return { success: true, data: result };
      }

      case 'updateValues': {
        const { spreadsheetId, range, values } = input;
        if (!spreadsheetId) throw new Error('spreadsheetId is required for action "updateValues"');
        if (!range) throw new Error('range is required for action "updateValues"');
        if (!values) throw new Error('values is required for action "updateValues"');
        const result = await ctx.integrate('google-sheets', 'updateValues', {
          connectionId,
          spreadsheetId,
          range,
          values,
        });
        return { success: true, data: result };
      }

      case 'createSheet': {
        const { spreadsheetId, title } = input;
        if (!spreadsheetId) throw new Error('spreadsheetId is required for action "createSheet"');
        if (!title) throw new Error('title is required for action "createSheet"');
        const result = await ctx.integrate('google-sheets', 'createSheet', {
          connectionId,
          spreadsheetId,
          title,
        });
        return { success: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
