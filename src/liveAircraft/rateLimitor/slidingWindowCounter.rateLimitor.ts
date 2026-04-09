import type { RateLimitDecision, RateLimitor, RateLimitorConfig } from './types';

// Per key:
// currentCount = requests in current window
// previousCount = requests in immediately previous window
// windowStart = aligned start of current window
type SlidingCounterState = {
  windowStart: number;
  currentCount: number;
  previousCount: number;
  lastSeenAt: number;
};

export class SlidingWindowCounterRateLimitor implements RateLimitor {
  private readonly states = new Map<string, SlidingCounterState>();
  private lastSweepAt = 0;

  constructor(private readonly config: RateLimitorConfig) {}

  allow(key: string, now: number): RateLimitDecision {
    // Periodic cleanup.
    this.sweepIfNeeded(now);

    const currentWindowStart = this.currentWindowStart(now);
    const state = this.states.get(key) ?? {
      windowStart: currentWindowStart,
      currentCount: 0,
      previousCount: 0,
      lastSeenAt: now,
    };

    // Move counter window forward when time crosses boundary.
    this.rollWindowIfNeeded(state, currentWindowStart);
    state.lastSeenAt = now;

    // Estimate rolling-window usage:
    // current window count + weighted previous window count.
    const elapsedInWindow = now - state.windowStart;
    const previousWeight =
      (this.config.windowMs - elapsedInWindow) / this.config.windowMs;
    const estimated = state.currentCount + state.previousCount * previousWeight;

    // Deny if estimated rolling usage is already over limit.
    if (estimated >= this.config.limit) {
      const retryAfterMs = Math.max(
        1,
        state.windowStart + this.config.windowMs - now,
      );
      this.states.set(key, state);
      return { allowed: false, retryAfterMs, remaining: 0 };
    }

    // Admit request in current window.
    state.currentCount += 1;
    this.states.set(key, state);
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

  private rollWindowIfNeeded(
    state: SlidingCounterState,
    currentWindowStart: number,
  ) {
    // Same window: no state rotation needed.
    if (currentWindowStart === state.windowStart) return;
    const windowsPassed =
      (currentWindowStart - state.windowStart) / this.config.windowMs;

    // Adjacent window keeps previous count; skipped windows reset previous.
    if (windowsPassed === 1) {
      state.previousCount = state.currentCount;
    } else {
      state.previousCount = 0;
    }

    state.currentCount = 0;
    state.windowStart = currentWindowStart;
  }

  private sweepIfNeeded(now: number) {
    // Sweep at most once per window.
    if (now - this.lastSweepAt < this.config.windowMs) return;
    this.lastSweepAt = now;

    // Drop inactive keys.
    const cutoff = now - this.config.windowMs * 5;
    for (const [key, state] of this.states.entries()) {
      if (state.lastSeenAt < cutoff) this.states.delete(key);
    }
  }
}
