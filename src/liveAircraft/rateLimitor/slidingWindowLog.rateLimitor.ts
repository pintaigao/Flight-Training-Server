import type { RateLimitDecision, RateLimitor, RateLimitorConfig } from './types';

// Per key request timestamps kept within the rolling window.
type SlidingLogState = {
  timestamps: number[];
  lastSeenAt: number;
};

export class SlidingWindowLogRateLimitor implements RateLimitor {
  private readonly states = new Map<string, SlidingLogState>();
  private lastSweepAt = 0;

  constructor(private readonly config: RateLimitorConfig) {}

  allow(key: string, now: number): RateLimitDecision {
    // Periodic cleanup.
    this.sweepIfNeeded(now);

    const state = this.states.get(key) ?? {
      timestamps: [],
      lastSeenAt: now,
    };

    // Keep only timestamps in (now - windowMs, now].
    const windowStart = now - this.config.windowMs;
    state.timestamps = state.timestamps.filter((ts) => ts > windowStart);
    state.lastSeenAt = now;

    // If we already have limit requests in rolling window, deny.
    if (state.timestamps.length >= this.config.limit) {
      const oldest = state.timestamps[0] ?? now;
      const retryAfterMs = Math.max(1, oldest + this.config.windowMs - now);
      this.states.set(key, state);
      return { allowed: false, retryAfterMs, remaining: 0 };
    }

    // Admit and append current request timestamp.
    state.timestamps.push(now);
    this.states.set(key, state);
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, this.config.limit - state.timestamps.length),
    };
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
