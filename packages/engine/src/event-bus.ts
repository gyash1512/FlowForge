type EventHandler = (payload: unknown) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);

    return () => {
      set!.delete(handler);
      if (set!.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  async emit(event: string, payload: unknown): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) return;
    const promises = [...set].map((handler) => handler(payload));
    await Promise.all(promises);
  }

  removeAll(): void {
    this.handlers.clear();
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}
