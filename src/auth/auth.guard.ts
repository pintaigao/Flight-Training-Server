import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { GqlExecutionContext } from '@nestjs/graphql';
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

  private getRequest(context: ExecutionContext): Request {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest<Request>();
    }
    const gql = GqlExecutionContext.create(context);
    return gql.getContext<{ req: Request }>().req;
  }

  private canActivateSession(context: ExecutionContext) {
    const req = this.getRequest(context);
    if (req.session?.userId) {
      req.user = { id: String(req.session.userId) };
      return true;
    }
    throw new UnauthorizedException();
  }

  private canActivateJwt(context: ExecutionContext) {
    const req = this.getRequest(context);
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
