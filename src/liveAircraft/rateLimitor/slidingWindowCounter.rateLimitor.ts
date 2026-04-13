import type { RateLimitDecision, RateLimitor, RateLimitorConfig, RateLimitorStateStore } from './types';

// Per key:
// currentCount = requests in current window
// previousCount = requests in immediately previous window
// windowStart = aligned start of current window
type SlidingCounterState = {
  windowStart: number;
  currentCount: number;
  previousCount: number;
};

export class SlidingWindowCounterRateLimitor implements RateLimitor {
  private readonly ttlMs: number;

  constructor(
    private readonly config: RateLimitorConfig,
    private readonly store: RateLimitorStateStore,
  ) {
    this.ttlMs = config.windowMs * 5;
  }

  async allow(key: string, now: number): Promise<RateLimitDecision> {
    const stateKey = `sliding_window_counter:${key}`;
    const currentWindowStart = this.currentWindowStart(now);
    const state = (await this.store.getState<SlidingCounterState>(stateKey)) ?? {
      windowStart: currentWindowStart,
      currentCount: 0,
      previousCount: 0,
    };

    // Move counter window forward when time crosses boundary.
    this.rollWindowIfNeeded(state, currentWindowStart);

    // Estimate rolling-window usage:
    // current window count + weighted previous window count.
    const elapsedInWindow = now - state.windowStart;
    const previousWeight = (this.config.windowMs - elapsedInWindow) / this.config.windowMs;
    const estimated = state.currentCount + state.previousCount * previousWeight;

    // Deny if estimated rolling usage is already over limit.
    if (estimated >= this.config.limit) {
      const retryAfterMs = Math.max(1, state.windowStart + this.config.windowMs - now);
      await this.store.setState(stateKey, state, this.ttlMs);
      return { allowed: false, retryAfterMs, remaining: 0 };
    }

    // Admit request in current window.
    state.currentCount += 1;
    await this.store.setState(stateKey, state, this.ttlMs);
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, Math.floor(this.config.limit - estimated - 1)),
    };
  }

  private currentWindowStart(now: number) {
    // Returns aligned fixed-window start.
    return Math.floor(now / this.config.windowMs) * this.config.windowMs;
  }

  private rollWindowIfNeeded(state: SlidingCounterState, currentWindowStart: number) {
    // Same window: no state rotation needed.
    if (currentWindowStart === state.windowStart) return;
    const windowsPassed = (currentWindowStart - state.windowStart) / this.config.windowMs;

    // Adjacent window keeps previous count; skipped windows reset previous.
    if (windowsPassed === 1) {
      state.previousCount = state.currentCount;
    } else {
      state.previousCount = 0;
    }

    state.currentCount = 0;
    state.windowStart = currentWindowStart;
  }
}
