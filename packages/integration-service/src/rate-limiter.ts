import { DEFAULT_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_WINDOW_MS } from '@flowforge/shared';

interface TokenBucket {
  tokens: number;
  max: number;
  windowMs: number;
  lastRefill: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  configure(name: string, max: number, windowMs: number): void {
    this.buckets.set(name, {
      tokens: max,
      max,
      windowMs,
      lastRefill: Date.now(),
    });
  }

  acquire(name: string): boolean {
    const bucket = this.getOrCreate(name);
    this.refill(bucket);

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  private getOrCreate(name: string): TokenBucket {
    let bucket = this.buckets.get(name);
    if (!bucket) {
      bucket = {
        tokens: DEFAULT_RATE_LIMIT_MAX,
        max: DEFAULT_RATE_LIMIT_MAX,
        windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
        lastRefill: Date.now(),
      };
      this.buckets.set(name, bucket);
    }
    return bucket;
  }

  private refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;

    if (elapsed >= bucket.windowMs) {
      const windows = Math.floor(elapsed / bucket.windowMs);
      bucket.tokens = Math.min(bucket.max, bucket.tokens + windows * bucket.max);
      bucket.lastRefill += windows * bucket.windowMs;
    }
  }
}
