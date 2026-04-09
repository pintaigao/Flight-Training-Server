// Supported algorithm names loaded from env.
export type RateLimitorAlgorithm =
  | 'token_bucket'
  | 'leaky_bucket'
  | 'fixed_window_counter'
  | 'sliding_window_log'
  | 'sliding_window_counter';

// Shared limiter config:
// limit = max requests in a window, windowMs = window size in milliseconds.
export type RateLimitorConfig = {
  limit: number;
  windowMs: number;
};

// Standard decision shape returned by all strategies.
export type RateLimitDecision = {
  // Whether this request is accepted.
  allowed: boolean;
  // How long caller should wait before retrying.
  retryAfterMs: number;
  // Approximate remaining quota in current view of the algorithm.
  remaining: number;
};

export interface RateLimitor {
  // Evaluate one request for the given key at the given timestamp.
  allow(key: string, now: number): RateLimitDecision;
}
