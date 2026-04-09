import { FixedWindowCounterRateLimitor } from './fixedWindowCounter.rateLimitor';
import { LeakyBucketRateLimitor } from './leakyBucket.rateLimitor';
import { SlidingWindowCounterRateLimitor } from './slidingWindowCounter.rateLimitor';
import { SlidingWindowLogRateLimitor } from './slidingWindowLog.rateLimitor';
import { TokenBucketRateLimitor } from './tokenBucket.rateLimitor';
import type { RateLimitor, RateLimitorAlgorithm, RateLimitorConfig } from './types';

// Default strategy when env value is missing/invalid.
const DEFAULT_ALGORITHM: RateLimitorAlgorithm = 'sliding_window_log';
const VALID_ALGORITHMS = new Set<RateLimitorAlgorithm>(['token_bucket', 'leaky_bucket', 'fixed_window_counter', 'sliding_window_log', 'sliding_window_counter']);

export function normalizeRateLimitorAlgorithm(raw: string | undefined): RateLimitorAlgorithm {
  // Allow friendly env inputs like "token-bucket" or "Token Bucket".
  const value = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (VALID_ALGORITHMS.has(value as RateLimitorAlgorithm)) {
    return value as RateLimitorAlgorithm;
  }
  return DEFAULT_ALGORITHM;
}

export function createRateLimitor(algorithm: RateLimitorAlgorithm, config: RateLimitorConfig): RateLimitor {
  console.log(config);
  // Factory: build the concrete limiter implementation selected by env.
  switch (algorithm) {
    case 'token_bucket':
      return new TokenBucketRateLimitor(config);
    case 'leaky_bucket':
      return new LeakyBucketRateLimitor(config);
    case 'fixed_window_counter':
      return new FixedWindowCounterRateLimitor(config);
    case 'sliding_window_counter':
      return new SlidingWindowCounterRateLimitor(config);
    case 'sliding_window_log':
    default:
      return new SlidingWindowLogRateLimitor(config);
  }
}

export type { RateLimitDecision, RateLimitor, RateLimitorAlgorithm, RateLimitorConfig } from './types';
