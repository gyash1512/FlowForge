import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../event-bus.js';

describe('EventBus', () => {
  it('emits events to handlers', async () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    await bus.emit('test', { data: 1 });
    expect(handler).toHaveBeenCalledWith({ data: 1 });
  });

  it('supports multiple handlers', async () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('test', h1);
    bus.on('test', h2);
    await bus.emit('test', 'payload');
    expect(h1).toHaveBeenCalledWith('payload');
    expect(h2).toHaveBeenCalledWith('payload');
  });

  it('returns unsubscribe function', async () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('test', handler);
    unsub();
    await bus.emit('test', 'payload');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing when emitting unregistered events', async () => {
    const bus = new EventBus();
    await expect(bus.emit('unknown', 'data')).resolves.toBeUndefined();
  });

  it('tracks listener count', () => {
    const bus = new EventBus();
    expect(bus.listenerCount('test')).toBe(0);
    const unsub = bus.on('test', () => {});
    expect(bus.listenerCount('test')).toBe(1);
    unsub();
    expect(bus.listenerCount('test')).toBe(0);
  });

  it('removeAll clears all handlers', async () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('a', handler);
    bus.on('b', handler);
    bus.removeAll();
    await bus.emit('a', null);
    await bus.emit('b', null);
    expect(handler).not.toHaveBeenCalled();
  });
});
