import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum([
    'createProducts',
    'cancelOrder',
    'closeOrder',
    'adjustInventory',
    'addToCollection',
  ]),
  products: z.array(z.unknown()).optional(),
  orderId: z.string().optional(),
  inventoryItemId: z.string().optional(),
  locationId: z.string().optional(),
  adjustment: z.number().int().optional(),
  collectionId: z.string().optional(),
  productId: z.string().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Shopify integration connection identifier'),
});

export const shopifyNode = defineNode({
  name: 'communication/shopify',
  version: '0.1.0',
  description: 'Create products, manage orders, and adjust inventory via Shopify',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['shopify', 'ecommerce', 'commerce'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createProducts': {
        const { products } = input;
        if (!products) throw new Error('products is required for action "createProducts"');
        const result = await ctx.integrate('shopify', 'createProducts', {
          connectionId,
          products,
        });
        return { success: true, data: result };
      }

      case 'cancelOrder': {
        const { orderId } = input;
        if (!orderId) throw new Error('orderId is required for action "cancelOrder"');
        const result = await ctx.integrate('shopify', 'cancelOrder', {
          connectionId,
          orderId,
        });
        return { success: true, data: result };
      }

      case 'closeOrder': {
        const { orderId } = input;
        if (!orderId) throw new Error('orderId is required for action "closeOrder"');
        const result = await ctx.integrate('shopify', 'closeOrder', {
          connectionId,
          orderId,
        });
        return { success: true, data: result };
      }

      case 'adjustInventory': {
        const { inventoryItemId, locationId, adjustment } = input;
        if (!inventoryItemId)
          throw new Error('inventoryItemId is required for action "adjustInventory"');
        if (!locationId) throw new Error('locationId is required for action "adjustInventory"');
        if (adjustment === undefined)
          throw new Error('adjustment is required for action "adjustInventory"');
        const result = await ctx.integrate('shopify', 'adjustInventory', {
          connectionId,
          inventoryItemId,
          locationId,
          adjustment,
        });
        return { success: true, data: result };
      }

      case 'addToCollection': {
        const { collectionId, productId } = input;
        if (!collectionId) throw new Error('collectionId is required for action "addToCollection"');
        if (!productId) throw new Error('productId is required for action "addToCollection"');
        const result = await ctx.integrate('shopify', 'addToCollection', {
          connectionId,
          collectionId,
          productId,
        });
        return { success: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
