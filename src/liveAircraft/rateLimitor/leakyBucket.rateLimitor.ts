import type { RateLimitDecision, RateLimitor, RateLimitorConfig } from './types';

// Per key:
// water = queued load inside bucket (higher means more pressure)
// lastLeakAt = last time we drained queue by elapsed time
// lastSeenAt = used for stale-key cleanup
type LeakyBucketState = {
  water: number;
  lastLeakAt: number;
  lastSeenAt: number;
};

export class LeakyBucketRateLimitor implements RateLimitor {
  private readonly states = new Map<string, LeakyBucketState>();
  // Leak speed (units per ms). Higher means queue drains faster.
  private readonly leakRatePerMs: number;
  private lastSweepAt = 0;

  constructor(private readonly config: RateLimitorConfig) {
    this.leakRatePerMs = config.limit / config.windowMs;
  }

  allow(key: string, now: number): RateLimitDecision {
    // Periodically remove stale keys.
    this.sweepIfNeeded(now);

    const state = this.states.get(key) ?? {
      water: 0,
      lastLeakAt: now,
      lastSeenAt: now,
    };

    // Leak queue based on elapsed time.
    const elapsed = Math.max(0, now - state.lastLeakAt);
    state.water = Math.max(0, state.water - elapsed * this.leakRatePerMs);
    state.lastLeakAt = now;
    state.lastSeenAt = now;

    // Admit request if bucket still has room.
    if (state.water + 1 <= this.config.limit) {
      state.water += 1;
      this.states.set(key, state);
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
    this.states.set(key, state);
    return { allowed: false, retryAfterMs, remaining: 0 };
  }

  private sweepIfNeeded(now: number) {
    // Sweep at most once per window.
    if (now - this.lastSweepAt < this.config.windowMs) return;
    this.lastSweepAt = now;

    // Drop keys inactive for multiple windows.
    const cutoff = now - this.config.windowMs * 5;
    for (const [key, state] of this.states.entries()) {
      if (state.lastSeenAt < cutoff) this.states.delete(key);
    }
  }
}
