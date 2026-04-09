import type { RateLimitDecision, RateLimitor, RateLimitorConfig } from './types';

// Per key:
// tokens = current available quota in bucket
// lastRefillAt = last time we refilled based on elapsed time
// lastSeenAt = used only for cleanup of cold keys
type TokenBucketState = {
  tokens: number;
  lastRefillAt: number;
  lastSeenAt: number;
};

export class TokenBucketRateLimitor implements RateLimitor {
  private readonly states = new Map<string, TokenBucketState>();
  // Tokens added per millisecond.
  private readonly refillRatePerMs: number;
  private lastSweepAt = 0;

  constructor(private readonly config: RateLimitorConfig) {
    this.refillRatePerMs = config.limit / config.windowMs;
  }

  allow(key: string, now: number): RateLimitDecision {
    // Periodically remove stale keys so map size does not grow forever.
    this.sweepIfNeeded(now);

    const state = this.states.get(key) ?? {
      // New key starts with a full bucket.
      tokens: this.config.limit,
      lastRefillAt: now,
      lastSeenAt: now,
    };

    // Refill tokens according to elapsed time since last request for this key.
    const elapsed = Math.max(0, now - state.lastRefillAt);
    state.tokens = Math.min(this.config.limit, state.tokens + elapsed * this.refillRatePerMs);
    state.lastRefillAt = now;
    state.lastSeenAt = now;

    // Consume one token for current request if available.
    if (state.tokens >= 1) {
      state.tokens -= 1;
      this.states.set(key, state);
      return {
        allowed: true,
        retryAfterMs: 0,
        remaining: Math.max(0, Math.floor(state.tokens)),
      };
    }

    // Not enough tokens: calculate when one full token will be refilled.
    const missingTokens = 1 - state.tokens;
    const retryAfterMs = Math.max(1, Math.ceil(missingTokens / this.refillRatePerMs));
    this.states.set(key, state);
    return { allowed: false, retryAfterMs, remaining: 0 };
  }

  private sweepIfNeeded(now: number) {
    // Sweep at most once per window to keep overhead low.
    if (now - this.lastSweepAt < this.config.windowMs) return;
    this.lastSweepAt = now;

    // Keep hot keys; delete keys inactive for multiple windows.
    const cutoff = now - this.config.windowMs * 5;
    for (const [key, state] of this.states.entries()) {
      if (state.lastSeenAt < cutoff) this.states.delete(key);
    }
  }
}
