/**
 * Durable Object for distributed rate limiting.
 * Uses sliding window algorithm with persistent state.
 */

import { RateLimiter, RateLimitResult, RATE_LIMITS } from './rate-limiter.js';

export class RateLimitDO implements DurableObject {
  private state: DurableObjectState;
  private limiter: RateLimiter;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.limiter = new RateLimiter(RATE_LIMITS.SESSION_CREATE);

    // Schedule periodic cleanup
    this.state.storage.setAlarm(Date.now() + 60_000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/check') {
      const key = url.searchParams.get('key') ?? 'default';
      const result = this.limiter.check(key);
      return Response.json(result);
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  async alarm(): Promise<void> {
    this.limiter.cleanup();
    // Reschedule cleanup
    this.state.storage.setAlarm(Date.now() + 60_000);
  }
}

/**
 * Check rate limit using the RateLimitDO.
 * Returns the result with remaining quota and reset time.
 */
export async function checkRateLimit(
  rateLimitDO: DurableObjectNamespace,
  key: string
): Promise<RateLimitResult> {
  // Use a fixed ID so all rate limit checks go to the same DO instance
  const id = rateLimitDO.idFromName('global-rate-limiter');
  const stub = rateLimitDO.get(id);

  const response = await stub.fetch(
    new Request(`http://internal/check?key=${encodeURIComponent(key)}`)
  );

  return response.json() as Promise<RateLimitResult>;
}
