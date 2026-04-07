import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['createRecord', 'listRecords', 'updateRecord', 'deleteRecord', 'createTable']),
  baseId: z.string().optional(),
  tableId: z.string().optional(),
  fields: z.record(z.unknown()).optional(),
  recordId: z.string().optional(),
  tableName: z.string().optional(),
  filterFormula: z.string().optional(),
  maxRecords: z.number().int().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Airtable integration connection identifier'),
});

export const airtableNode = defineNode({
  name: 'communication/airtable',
  version: '0.1.0',
  description: 'Create, read, update, and delete records and tables via Airtable',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['airtable', 'database', 'spreadsheet'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createRecord': {
        const { baseId, tableId, fields } = input;
        if (!baseId) throw new Error('baseId is required for action "createRecord"');
        if (!tableId) throw new Error('tableId is required for action "createRecord"');
        if (!fields) throw new Error('fields is required for action "createRecord"');
        const result = await ctx.integrate('airtable', 'createRecord', {
          connectionId,
          baseId,
          tableId,
          fields,
        });
        return { success: true, data: result };
      }

      case 'listRecords': {
        const { baseId, tableId, filterFormula, maxRecords } = input;
        if (!baseId) throw new Error('baseId is required for action "listRecords"');
        if (!tableId) throw new Error('tableId is required for action "listRecords"');
        const result = await ctx.integrate('airtable', 'listRecords', {
          connectionId,
          baseId,
          tableId,
          filterFormula,
          maxRecords,
        });
        return { success: true, data: result };
      }

      case 'updateRecord': {
        const { baseId, tableId, recordId, fields } = input;
        if (!baseId) throw new Error('baseId is required for action "updateRecord"');
        if (!tableId) throw new Error('tableId is required for action "updateRecord"');
        if (!recordId) throw new Error('recordId is required for action "updateRecord"');
        if (!fields) throw new Error('fields is required for action "updateRecord"');
        const result = await ctx.integrate('airtable', 'updateRecord', {
          connectionId,
          baseId,
          tableId,
          recordId,
          fields,
        });
        return { success: true, data: result };
      }

      case 'deleteRecord': {
        const { baseId, tableId, recordId } = input;
        if (!baseId) throw new Error('baseId is required for action "deleteRecord"');
        if (!tableId) throw new Error('tableId is required for action "deleteRecord"');
        if (!recordId) throw new Error('recordId is required for action "deleteRecord"');
        const result = await ctx.integrate('airtable', 'deleteRecord', {
          connectionId,
          baseId,
          tableId,
          recordId,
        });
        return { success: true, data: result };
      }

      case 'createTable': {
        const { baseId, tableName, fields } = input;
        if (!baseId) throw new Error('baseId is required for action "createTable"');
        if (!tableName) throw new Error('tableName is required for action "createTable"');
        const result = await ctx.integrate('airtable', 'createTable', {
          connectionId,
          baseId,
          tableName,
          fields,
        });
        return { success: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
