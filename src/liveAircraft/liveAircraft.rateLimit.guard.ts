import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { createRateLimitor, normalizeRateLimitorAlgorithm, type RateLimitor, type RateLimitorAlgorithm } from './rateLimitor';

@Injectable()
export class LiveAircraftRateLimitGuard implements CanActivate {
  private readonly limit = this.readNumber(process.env.LIVE_AIRCRAFT_RATE_LIMIT, 20, 1);
  private readonly windowMs = this.readNumber(process.env.LIVE_AIRCRAFT_RATE_WINDOW_MS, 60_000, 1_000);
  private readonly algorithm: RateLimitorAlgorithm = normalizeRateLimitorAlgorithm(process.env.LIVE_AIRCRAFT_RATE_ALGORITHM);
  private readonly limitor: RateLimitor = createRateLimitor(this.algorithm, {
    limit: this.limit,
    windowMs: this.windowMs,
  });

  // Override return false or true
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.buildKey(request);
    const now = Date.now();
    const decision = this.limitor.allow(key, now);

    if (!decision.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
      throw new HttpException(
        {
          message: 'Too many live-aircraft requests, please retry later.',
          retryAfterSeconds,
          algorithm: this.algorithm,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  // 把当前请求转换成限流键：ip:userId。 It turns the current request into a limiter key: ip:userId.
  // 先拿 IP（readClientIp）First gets IP (readClientIp)
  // 再拿用户 ID（没登录就 anon）Then gets user ID (anon if not logged in)
  // 返回如 192.168.1.10:u123 或 192.168.1.10:anon Returns values like 192.168.1.10:u123 or 192.168.1.10:anon
  // 这样同一 IP 不同用户会分开计数。This lets different users on the same IP be counted separately.
  private buildKey(req: Request) {
    const ip = this.readClientIp(req);
    const userId = req.user?.id ? String(req.user.id) : 'anon';
    return `${ip}:${userId}`;
  }

  // readClientIp(req) 尽量准确拿“真实客户端 IP”。
  // It tries to extract the real client IP.
  // 优先级是：
  // Priority order:
  // x-forwarded-for 的第一个 IP（经过反代时最常用）First IP in x-forwarded-for (common behind reverse proxy)
  // req.ip
  // req.socket.remoteAddress
  // 都没有就 unknown fallback unknown
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

  // readNumber(raw, fallback, min)
  // 把环境变量字符串安全地转成数字。Safely parses env string into a number.
  // parseInt 成功就用它 Uses parsed integer if valid
  // 解析失败就回退 fallback Falls back to fallback if invalid
  // 最后保证不小于 min Ensures value is not below min
  // 典型用途就是读： Typical use: reading
  //
  // LIVE_AIRCRAFT_RATE_LIMIT
  // LIVE_AIRCRAFT_RATE_WINDOW_MS
  // 避免配置写错导致限流失效或变成 0。This prevents bad config from disabling limiter or making it 0 accidentally.
  private readNumber(raw: string | undefined, fallback: number, min: number): number {
    const n = Number.parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, n);
  }
}
