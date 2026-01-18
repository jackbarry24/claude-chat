/**
 * Simple sliding window rate limiter for Durable Objects.
 * Tracks request timestamps and enforces limits per time window.
 */

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Rate limiter that tracks requests per key (e.g., IP address, participant ID).
 * Uses a sliding window algorithm for smooth rate limiting.
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed and record it if so.
   * @param key - Identifier for the rate limit bucket (e.g., IP, session+participant)
   * @returns Result indicating if request is allowed and remaining quota
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing timestamps and filter to current window
    let timestamps = this.requests.get(key) ?? [];
    timestamps = timestamps.filter((t) => t > windowStart);

    const remaining = Math.max(0, this.config.maxRequests - timestamps.length);
    const firstTimestamp = timestamps[0];
    const resetAt = firstTimestamp !== undefined
      ? firstTimestamp + this.config.windowMs
      : now + this.config.windowMs;

    if (timestamps.length >= this.config.maxRequests) {
      this.requests.set(key, timestamps);
      return { allowed: false, remaining: 0, resetAt };
    }

    // Record this request
    timestamps.push(now);
    this.requests.set(key, timestamps);

    return { allowed: true, remaining: remaining - 1, resetAt };
  }

  /**
   * Clean up old entries to prevent memory leaks.
   * Should be called periodically.
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter((t) => t > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
  }
}

/**
 * Default rate limit configurations for different operations.
 */
export const RATE_LIMITS = {
  /** Session creation: 10 per minute per IP */
  SESSION_CREATE: { maxRequests: 10, windowMs: 60_000 },
  /** Join attempts: 20 per minute per session (to prevent brute force) */
  SESSION_JOIN: { maxRequests: 20, windowMs: 60_000 },
  /** Message sending: 60 per minute per participant */
  MESSAGE_SEND: { maxRequests: 60, windowMs: 60_000 },
  /** Message reading: 120 per minute per participant */
  MESSAGE_READ: { maxRequests: 120, windowMs: 60_000 },
  /** General API calls: 300 per minute per session */
  GENERAL: { maxRequests: 300, windowMs: 60_000 },
} as const;
