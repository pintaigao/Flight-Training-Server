import type { RateLimitDecision, RateLimitor, RateLimitorConfig, RateLimitorStateStore } from './types';

// Per key:
// tokens = current available quota in bucket
// lastRefillAt = last time we refilled based on elapsed time
type TokenBucketState = {
  tokens: number;
  lastRefillAt: number;
};

export class TokenBucketRateLimitor implements RateLimitor {
  // Tokens added per millisecond.
  private readonly refillRatePerMs: number;
  private readonly ttlMs: number;

  constructor(
    private readonly config: RateLimitorConfig,
    private readonly store: RateLimitorStateStore,
  ) {
    this.refillRatePerMs = config.limit / config.windowMs;
    this.ttlMs = config.windowMs * 5;
  }

  async allow(key: string, now: number): Promise<RateLimitDecision> {
    const stateKey = `token_bucket:${key}`;
    const state = (await this.store.getState<TokenBucketState>(stateKey)) ?? {
      // New key starts with a full bucket.
      tokens: this.config.limit,
      lastRefillAt: now,
    };

    // Refill tokens according to elapsed time since last request for this key.
    const elapsed = Math.max(0, now - state.lastRefillAt);
    state.tokens = Math.min(this.config.limit, state.tokens + elapsed * this.refillRatePerMs);
    state.lastRefillAt = now;

    // Consume one token for current request if available.
    if (state.tokens >= 1) {
      state.tokens -= 1;
      await this.store.setState(stateKey, state, this.ttlMs);
      return {
        allowed: true,
        retryAfterMs: 0,
        remaining: Math.max(0, Math.floor(state.tokens)),
      };
    }

    // Not enough tokens: calculate when one full token will be refilled.
    const missingTokens = 1 - state.tokens;
    const retryAfterMs = Math.max(1, Math.ceil(missingTokens / this.refillRatePerMs));
    await this.store.setState(stateKey, state, this.ttlMs);
    return { allowed: false, retryAfterMs, remaining: 0 };
  }
}
