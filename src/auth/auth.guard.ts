import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { readBearerToken, verifyAccessToken } from '../utils/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const mode = (process.env.AUTH_MODE ?? 'session').toLowerCase();

    if (mode === 'jwt') {
      return this.canActivateJwt(context);
    } else {
      return this.canActivateSession(context);
    }
  }

  private canActivateSession(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.session?.userId) {
      req.user = { id: String(req.session.userId) };
      return true;
    }
    throw new UnauthorizedException();
  }

  private canActivateJwt(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const token = readBearerToken(req.headers.authorization);
    if (!token) throw new UnauthorizedException();
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
