import type {
  RateLimitDecision,
  RateLimitor,
  RateLimitorConfig,
  RateLimitorStateStore,
} from './types';

// Per key request timestamps kept within the rolling window.
type SlidingLogState = {
  timestamps: number[];
};

export class SlidingWindowLogRateLimitor implements RateLimitor {
  private readonly ttlMs: number;

  constructor(
    private readonly config: RateLimitorConfig,
    private readonly store: RateLimitorStateStore,
  ) {
    this.ttlMs = config.windowMs * 5;
  }

  async allow(key: string, now: number): Promise<RateLimitDecision> {
    const stateKey = `sliding_window_log:${key}`;
    const state =
      (await this.store.getState<SlidingLogState>(stateKey)) ?? {
        timestamps: [],
      };

    // Keep only timestamps in (now - windowMs, now].
    const windowStart = now - this.config.windowMs;
    state.timestamps = state.timestamps.filter((ts) => ts > windowStart);

    // If we already have limit requests in rolling window, deny.
    if (state.timestamps.length >= this.config.limit) {
      const oldest = state.timestamps[0] ?? now;
      const retryAfterMs = Math.max(1, oldest + this.config.windowMs - now);
      await this.store.setState(stateKey, state, this.ttlMs);
      return { allowed: false, retryAfterMs, remaining: 0 };
    }

    // Admit and append current request timestamp.
    state.timestamps.push(now);
    await this.store.setState(stateKey, state, this.ttlMs);
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, this.config.limit - state.timestamps.length),
    };
  }
}
