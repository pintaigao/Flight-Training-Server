import { createClient } from 'redis';
import type { RateLimitorStateBackend, RateLimitorStateStore } from './types';

type InMemoryEntry = {
  raw: string;
  expiresAt: number;
};

type CreateStateStoreOptions = {
  backend: RateLimitorStateBackend;
  redisUrl?: string;
  keyPrefix?: string;
};

class InMemoryRateLimitorStateStore implements RateLimitorStateStore {
  private readonly map = new Map<string, InMemoryEntry>();

  async getState<T>(key: string): Promise<T | null> {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      return null;
    }
    try {
      return JSON.parse(entry.raw) as T;
    } catch {
      this.map.delete(key);
      return null;
    }
  }

  async setState<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.map.set(key, {
      raw: JSON.stringify(value),
      expiresAt: Date.now() + Math.max(1, ttlMs),
    });
  }
}

class RedisRateLimitorStateStore implements RateLimitorStateStore {
  private static readonly clients = new Map<string, ReturnType<typeof createClient>>();
  private static readonly connecting = new Map<string, Promise<unknown>>();
  private readonly keyPrefix: string;

  constructor(
    private readonly redisUrl: string,
    keyPrefix = 'live_aircraft:rate_limitor:',
  ) {
    this.keyPrefix = keyPrefix;
  }

  async getState<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    const raw = await client.get(this.fullKey(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setState<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const client = await this.getClient();
    await client.set(this.fullKey(key), JSON.stringify(value), {
      PX: Math.max(1, Math.floor(ttlMs)),
    });
  }

  private fullKey(key: string) {
    return `${this.keyPrefix}${key}`;
  }

  private async getClient() {
    let client = RedisRateLimitorStateStore.clients.get(this.redisUrl);
    if (!client) {
      client = createClient({ url: this.redisUrl });
      RedisRateLimitorStateStore.clients.set(this.redisUrl, client);
    }

    if (!client.isOpen) {
      let pending = RedisRateLimitorStateStore.connecting.get(this.redisUrl);
      if (!pending) {
        pending = client.connect();
        RedisRateLimitorStateStore.connecting.set(this.redisUrl, pending);
      }
      try {
        await pending;
      } finally {
        RedisRateLimitorStateStore.connecting.delete(this.redisUrl);
      }
    }

    return client;
  }
}

export function createRateLimitorStateStore(options: CreateStateStoreOptions): RateLimitorStateStore {
  if (options.backend === 'redis') {
    const redisUrl = options.redisUrl?.trim();
    if (!redisUrl) {
      throw new Error('LIVE_AIRCRAFT_RATE_STATE_BACKEND=redis requires REDIS_URL');
    }
    return new RedisRateLimitorStateStore(redisUrl, options.keyPrefix);
  }

  return new InMemoryRateLimitorStateStore();
}
