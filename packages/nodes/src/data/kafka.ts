import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['produce', 'consume', 'listTopics']),
  topic: z.string().optional(),
  messages: z
    .array(
      z.object({
        key: z.string().optional(),
        value: z.string(),
        partition: z.number().int().optional(),
        headers: z.record(z.string()).optional(),
      }),
    )
    .optional(),
  groupId: z.string().optional(),
  maxMessages: z.number().int().optional(),
  timeout: z.number().int().optional(),
});

const outputSchema = z.object({
  value: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Kafka connection identifier'),
});

export const kafkaNode = defineNode({
  name: 'data/kafka',
  version: '0.1.0',
  description: 'Produce and consume messages from Apache Kafka',
  category: 'data',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['kafka', 'streaming', 'message-queue'],

  handler: async (ctx) => {
    const { action, topic, messages, groupId, maxMessages, timeout } = ctx.input;
    const { connectionId } = ctx.config;

    switch (action) {
      case 'produce': {
        if (!topic) throw new Error('topic is required for action "produce"');
        if (!messages || messages.length === 0) throw new Error('messages are required for action "produce"');
        await ctx.push('kafka', {
          connectionId,
          command: 'PRODUCE',
          args: { topic, messages },
        });
        return { value: { messageCount: messages.length }, success: true };
      }

      case 'consume': {
        if (!topic) throw new Error('topic is required for action "consume"');
        if (!groupId) throw new Error('groupId is required for action "consume"');
        const result = await ctx.pull('kafka', {
          connectionId,
          command: 'CONSUME',
          args: { topic, groupId, maxMessages: maxMessages ?? 10, timeout: timeout ?? 5000 },
        });
        return { value: result, success: true };
      }

      case 'listTopics': {
        const result = await ctx.pull('kafka', {
          connectionId,
          command: 'LIST_TOPICS',
          args: {},
        });
        return { value: result, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
