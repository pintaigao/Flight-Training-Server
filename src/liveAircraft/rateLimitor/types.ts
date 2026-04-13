// Supported algorithm names loaded from env.
export type RateLimitorAlgorithm =
  | 'token_bucket'
  | 'leaky_bucket'
  | 'fixed_window_counter'
  | 'sliding_window_log'
  | 'sliding_window_counter';

// Where limiter state is stored.
export type RateLimitorStateBackend = 'memory' | 'redis';

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

export interface RateLimitorStateStore {
  // Read serialized state by key. Returns null when missing/expired.
  getState<T>(key: string): Promise<T | null>;
  // Persist state with TTL so cold keys are auto-cleaned.
  setState<T>(key: string, value: T, ttlMs: number): Promise<void>;
}

export interface RateLimitor {
  // Evaluate one request for the given key at the given timestamp.
  allow(key: string, now: number): Promise<RateLimitDecision>;
}
