/**
 * Model Provider Registry
 *
 * Register AI model providers explicitly. No auto-detection, no dynamic imports.
 * The user installs the provider package and registers it:
 *
 *   import { openai } from '@ai-sdk/openai';
 *   engine.models.register({
 *     name: 'openai',
 *     models: ['gpt-4o', 'gpt-4o-mini'],
 *     createModel: (id) => openai(id),
 *   });
 *
 *   // Then in workflows:
 *   const { model } = engine.models.resolve('openai/gpt-4o');
 */

export interface ModelProvider {
  /** Provider identifier, e.g. 'openai', 'anthropic', 'google' */
  name: string;
  /** Known model IDs for this provider */
  models: string[];
  /**
   * Create a provider-specific model object for a given model ID.
   * Returned value is passed to AI SDK functions as the `model` parameter.
   */
  createModel(modelId: string): unknown;
}

export class ModelRegistry {
  private providers = new Map<string, ModelProvider>();

  /** Register a model provider. Replaces any existing with the same name. */
  register(provider: ModelProvider): void {
    this.providers.set(provider.name, provider);
  }

  /** Get a provider by name. */
  get(providerName: string): ModelProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Resolve a "provider/model" string to the provider and a model object.
   * @param modelString  e.g. "anthropic/claude-sonnet-4-20250514"
   */
  resolve(modelString: string): { provider: ModelProvider; model: unknown } {
    const slashIndex = modelString.indexOf('/');
    if (slashIndex === -1) {
      throw new Error(
        `Invalid model string "${modelString}". Expected "provider/model" (e.g. "openai/gpt-4o")`,
      );
    }

    const providerName = modelString.slice(0, slashIndex);
    const modelId = modelString.slice(slashIndex + 1);

    const provider = this.providers.get(providerName);
    if (!provider) {
      const available = [...this.providers.keys()].join(', ') || '(none)';
      throw new Error(`Provider "${providerName}" not registered. Available: ${available}`);
    }

    return { provider, model: provider.createModel(modelId) };
  }

  /** List all registered providers and their models. */
  list(): Array<{ provider: string; models: string[] }> {
    return [...this.providers.values()].map((p) => ({
      provider: p.name,
      models: [...p.models],
    }));
  }

  /** Remove a provider. */
  unregister(providerName: string): boolean {
    return this.providers.delete(providerName);
  }
}
