import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { createRateLimitor, createRateLimitorStateStore, normalizeRateLimitorAlgorithm, normalizeRateLimitorStateBackend, type RateLimitor, type RateLimitorAlgorithm, type RateLimitorStateBackend } from './rateLimitor';

@Injectable()
export class LiveAircraftRateLimitGuard implements CanActivate {
  private readonly limit = this.readNumber(process.env.LIVE_AIRCRAFT_RATE_LIMIT, 20, 1);
  private readonly windowMs = this.readNumber(process.env.LIVE_AIRCRAFT_RATE_WINDOW_MS, 60_000, 1_000);
  private readonly algorithm: RateLimitorAlgorithm = normalizeRateLimitorAlgorithm(process.env.LIVE_AIRCRAFT_RATE_ALGORITHM);
  private readonly stateBackend: RateLimitorStateBackend = normalizeRateLimitorStateBackend(process.env.LIVE_AIRCRAFT_RATE_STATE_BACKEND);
  private readonly limitor: RateLimitor = createRateLimitor(
    this.algorithm,
    {
      limit: this.limit,
      windowMs: this.windowMs,
    },
    createRateLimitorStateStore({
      backend: this.stateBackend,
      redisUrl: process.env.REDIS_URL,
      keyPrefix: 'live_aircraft:rate_limitor:',
    }),
  );

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.buildKey(request);
    const now = Date.now();
    const decision = await this.limitor.allow(key, now);

    if (!decision.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
      throw new HttpException(
        {
          message: 'Too many live-aircraft requests, please retry later.',
          retryAfterSeconds,
          algorithm: this.algorithm,
          stateBackend: this.stateBackend,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private buildKey(req: Request) {
    const ip = this.readClientIp(req);
    const userId = req.user?.id ? String(req.user.id) : 'anon';
    return `${ip}:${userId}`;
  }

  private readClientIp(req: Request) {
    const xff = req.headers['x-forwarded-for'];
    const forwardedFor = Array.isArray(xff) ? xff[0] : xff;
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      const first = forwardedFor.split(',')[0]?.trim();
      if (first) return first;
    }

    if (req.ip) return req.ip;
    if (req.socket?.remoteAddress) return req.socket.remoteAddress;
    return 'unknown';
  }

  private readNumber(raw: string | undefined, fallback: number, min: number): number {
    const n = Number.parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, n);
  }
}
