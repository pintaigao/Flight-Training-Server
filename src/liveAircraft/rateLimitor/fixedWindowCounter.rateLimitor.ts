import type {
  RateLimitDecision,
  RateLimitor,
  RateLimitorConfig,
  RateLimitorStateStore,
} from './types';

// Per key counter for current fixed window.
type FixedWindowState = {
  windowStart: number;
  count: number;
};

export class FixedWindowCounterRateLimitor implements RateLimitor {
  private readonly ttlMs: number;

  constructor(
    private readonly config: RateLimitorConfig,
    private readonly store: RateLimitorStateStore,
  ) {
    this.ttlMs = config.windowMs * 5;
  }

  async allow(key: string, now: number): Promise<RateLimitDecision> {
    const stateKey = `fixed_window_counter:${key}`;

    // Window boundaries are fixed by floor(now / windowMs).
    const start = this.currentWindowStart(now);
    const state =
      (await this.store.getState<FixedWindowState>(stateKey)) ?? {
        windowStart: start,
        count: 0,
      };

    // On new window, reset counter.
    if (state.windowStart !== start) {
      state.windowStart = start;
      state.count = 0;
    }

    // Deny once count reaches limit in this window.
    if (state.count >= this.config.limit) {
      const retryAfterMs = Math.max(
        1,
        state.windowStart + this.config.windowMs - now,
      );
      await this.store.setState(stateKey, state, this.ttlMs);
      return { allowed: false, retryAfterMs, remaining: 0 };
    }

    state.count += 1;
    await this.store.setState(stateKey, state, this.ttlMs);
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, this.config.limit - state.count),
    };
  }

  private currentWindowStart(now: number) {
    // Returns the aligned start timestamp for the fixed window.
    return Math.floor(now / this.config.windowMs) * this.config.windowMs;
  }
}
