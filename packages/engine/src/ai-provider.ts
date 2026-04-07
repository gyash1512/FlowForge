import type {
  AIContext,
  AITextResponse,
  AIStreamResponse,
  AIObjectResponse,
  AIEmbedResponse,
  AIRequestParams,
  AIObjectParams,
  AIEmbedParams,
} from '@flowforgejs/shared';

export interface AISDKFunctions {
  generateText: (params: AIRequestParams) => Promise<AITextResponse>;
  streamText: (params: AIRequestParams) => Promise<AIStreamResponse>;
  generateObject: (params: AIObjectParams) => Promise<AIObjectResponse>;
  embed: (params: AIEmbedParams) => Promise<AIEmbedResponse>;
}

/**
 * Creates an AIContext from explicitly passed AI SDK functions.
 * No dynamic imports — the user passes the functions they want to use.
 *
 *   import { generateText, streamText, generateObject, embed } from 'ai';
 *   const ai = createAIProvider({ generateText, streamText, generateObject, embed });
 */
export function createAIProvider(sdk: AISDKFunctions): AIContext {
  return {
    generateText: (params) => sdk.generateText(params),
    streamText: (params) => sdk.streamText(params),
    generateObject: (params) => sdk.generateObject(params),
    embed: (params) => sdk.embed(params),
  };
}

/** Noop AI context — returns empty results for all methods. */
export function createNoopAIProvider(): AIContext {
  return {
    generateText: async () => ({
      text: '',
      toolCalls: [],
      toolResults: [],
      usage: { promptTokens: 0, completionTokens: 0 },
    }),
    streamText: async () => ({
      textStream: (async function* () {})(),
      text: Promise.resolve(''),
      usage: Promise.resolve({ promptTokens: 0, completionTokens: 0 }),
    }),
    generateObject: async () => ({
      object: {},
      usage: { promptTokens: 0, completionTokens: 0 },
    }),
    embed: async () => ({
      embedding: [],
      usage: { tokens: 0 },
    }),
  };
}
