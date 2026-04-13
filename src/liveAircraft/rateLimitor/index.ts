import { FixedWindowCounterRateLimitor } from './fixedWindowCounter.rateLimitor';
import { LeakyBucketRateLimitor } from './leakyBucket.rateLimitor';
import { SlidingWindowCounterRateLimitor } from './slidingWindowCounter.rateLimitor';
import { SlidingWindowLogRateLimitor } from './slidingWindowLog.rateLimitor';
import { createRateLimitorStateStore } from './stateStore';
import { TokenBucketRateLimitor } from './tokenBucket.rateLimitor';
import type { RateLimitor, RateLimitorAlgorithm, RateLimitorConfig, RateLimitorStateBackend, RateLimitorStateStore } from './types';

// Default strategy when env value is missing/invalid.
const DEFAULT_ALGORITHM: RateLimitorAlgorithm = 'sliding_window_log';
const VALID_ALGORITHMS = new Set<RateLimitorAlgorithm>(['token_bucket', 'leaky_bucket', 'fixed_window_counter', 'sliding_window_log', 'sliding_window_counter']);

const DEFAULT_STATE_BACKEND: RateLimitorStateBackend = 'memory';
const VALID_STATE_BACKENDS = new Set<RateLimitorStateBackend>(['memory', 'redis']);

export function normalizeRateLimitorAlgorithm(raw: string | undefined): RateLimitorAlgorithm {
  // Allow friendly env inputs like "token-bucket" or "Token Bucket".
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (VALID_ALGORITHMS.has(value as RateLimitorAlgorithm)) {
    return value as RateLimitorAlgorithm;
  }
  return DEFAULT_ALGORITHM;
}

export function normalizeRateLimitorStateBackend(raw: string | undefined): RateLimitorStateBackend {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (VALID_STATE_BACKENDS.has(value as RateLimitorStateBackend)) {
    return value as RateLimitorStateBackend;
  }
  return DEFAULT_STATE_BACKEND;
}

export function createRateLimitor(algorithm: RateLimitorAlgorithm, config: RateLimitorConfig, store: RateLimitorStateStore): RateLimitor {
  // Factory: build the concrete limiter implementation selected by env.
  switch (algorithm) {
    case 'token_bucket':
      return new TokenBucketRateLimitor(config, store);
    case 'leaky_bucket':
      return new LeakyBucketRateLimitor(config, store);
    case 'fixed_window_counter':
      return new FixedWindowCounterRateLimitor(config, store);
    case 'sliding_window_counter':
      return new SlidingWindowCounterRateLimitor(config, store);
    case 'sliding_window_log':
    default:
      return new SlidingWindowLogRateLimitor(config, store);
  }
}

export { createRateLimitorStateStore };
export type { RateLimitDecision, RateLimitor, RateLimitorAlgorithm, RateLimitorConfig, RateLimitorStateBackend, RateLimitorStateStore } from './types';
