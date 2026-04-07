import type { IntegrationAdaptor } from '@flowforgejs/shared';

export class AdaptorRegistry {
  private readonly adaptors = new Map<string, IntegrationAdaptor>();

  register(adaptor: IntegrationAdaptor): void {
    this.adaptors.set(adaptor.name, adaptor);
  }

  get(name: string): IntegrationAdaptor | undefined {
    return this.adaptors.get(name);
  }

  list(): IntegrationAdaptor[] {
    return [...this.adaptors.values()];
  }

  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const entries = [...this.adaptors.entries()];

    await Promise.all(
      entries.map(async ([name, adaptor]) => {
        try {
          const healthy = await adaptor.healthCheck();
          results.set(name, healthy);
        } catch {
          results.set(name, false);
        }
      }),
    );

    return results;
  }
}
