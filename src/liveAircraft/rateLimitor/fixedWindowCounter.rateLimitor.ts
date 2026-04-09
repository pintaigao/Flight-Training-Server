import type { RateLimitDecision, RateLimitor, RateLimitorConfig } from './types';

// Per key counter for current fixed window.
type FixedWindowState = {
  windowStart: number;
  count: number;
  lastSeenAt: number;
};

export class FixedWindowCounterRateLimitor implements RateLimitor {
  private readonly states = new Map<string, FixedWindowState>();
  private lastSweepAt = 0;

  constructor(private readonly config: RateLimitorConfig) {}

  allow(key: string, now: number): RateLimitDecision {
    // Periodic cleanup.
    this.sweepIfNeeded(now);

    // Window boundaries are fixed by floor(now / windowMs).
    const start = this.currentWindowStart(now);
    const state = this.states.get(key) ?? {
      windowStart: start,
      count: 0,
      lastSeenAt: now,
    };

    // On new window, reset counter.
    if (state.windowStart !== start) {
      state.windowStart = start;
      state.count = 0;
    }

    state.lastSeenAt = now;

    // Deny once count reaches limit in this window.
    if (state.count >= this.config.limit) {
      const retryAfterMs = Math.max(
        1,
        state.windowStart + this.config.windowMs - now,
      );
      this.states.set(key, state);
      return { allowed: false, retryAfterMs, remaining: 0 };
    }

    state.count += 1;
    this.states.set(key, state);
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
