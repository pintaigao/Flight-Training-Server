import type {
  RateLimitDecision,
  RateLimitor,
  RateLimitorConfig,
  RateLimitorStateStore,
} from './types';

// Per key:
// water = queued load inside bucket (higher means more pressure)
// lastLeakAt = last time we drained queue by elapsed time
type LeakyBucketState = {
  water: number;
  lastLeakAt: number;
};

export class LeakyBucketRateLimitor implements RateLimitor {
  // Leak speed (units per ms). Higher means queue drains faster.
  private readonly leakRatePerMs: number;
  private readonly ttlMs: number;

  constructor(
    private readonly config: RateLimitorConfig,
    private readonly store: RateLimitorStateStore,
  ) {
    this.leakRatePerMs = config.limit / config.windowMs;
    this.ttlMs = config.windowMs * 5;
  }

  async allow(key: string, now: number): Promise<RateLimitDecision> {
    const stateKey = `leaky_bucket:${key}`;
    const state =
      (await this.store.getState<LeakyBucketState>(stateKey)) ?? {
        water: 0,
        lastLeakAt: now,
      };

    // Leak queue based on elapsed time.
    const elapsed = Math.max(0, now - state.lastLeakAt);
    state.water = Math.max(0, state.water - elapsed * this.leakRatePerMs);
    state.lastLeakAt = now;

    // Admit request if bucket still has room.
    if (state.water + 1 <= this.config.limit) {
      state.water += 1;
      await this.store.setState(stateKey, state, this.ttlMs);
      return {
        allowed: true,
        retryAfterMs: 0,
        remaining: Math.max(0, Math.floor(this.config.limit - state.water)),
      };
    }

    // Bucket is full: estimate next time when enough water leaks out.
    const overflow = state.water + 1 - this.config.limit;
    const retryAfterMs = Math.max(
      1,
      Math.ceil(overflow / this.leakRatePerMs),
    );
    await this.store.setState(stateKey, state, this.ttlMs);
    return { allowed: false, retryAfterMs, remaining: 0 };
  }
}
