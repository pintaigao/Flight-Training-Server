import { Controller, Post, Body, Get, Req, Res, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import type { Request, Response } from 'express';
import { readBearerToken, signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../utils/jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  private mode() {
    return (process.env.AUTH_MODE ?? 'session').toLowerCase();
  }

  private refreshCookieName() {
    return process.env.REFRESH_COOKIE_NAME ?? 'refreshToken';
  }

  private refreshCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      // Frontend calls the API under `/api/v1/*` directly,
      // so the cookie path must include that prefix to be sent on refresh requests.
      path: '/api/v1',
    };
  }

  private readCookie(req: Request, name: string): string | null {
    const raw = req.headers?.cookie;
    if (typeof raw !== 'string' || !raw) return null;
    const parts = raw.split(';');
    for (const p of parts) {
      const [k, ...rest] = p.trim().split('=');
      if (!k) continue;
      if (k === name) return decodeURIComponent(rest.join('=') || '');
    }
    return null;
  }

  @Post('register')
  async register(@Body() body: { email: string; password: string; inviteCode: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.userService.create(body.email, body.password, body.inviteCode);
    if (!user) throw new UnauthorizedException('Void Invitation');

    if (this.mode() === 'jwt') {
      const accessToken = signAccessToken({ sub: String(user.id), email: user.email });
      const refreshToken = signRefreshToken({ sub: String(user.id), email: user.email });
      res.cookie(this.refreshCookieName(), refreshToken, this.refreshCookieOptions());
      return { id: String(user.id), email: user.email, accessToken };
    }
    req.session.userId = user.id;
    return { id: String(user.id), email: user.email };
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (this.mode() === 'jwt') {
      const accessToken = signAccessToken({ sub: String(user.id), email: user.email });
      const refreshToken = signRefreshToken({ sub: String(user.id), email: user.email });
      res.cookie(this.refreshCookieName(), refreshToken, this.refreshCookieOptions());
      return { id: String(user.id), email: user.email, accessToken };
    }
    req.session.userId = user.id;
    return { id: String(user.id), email: user.email };
  }

  @Post('google')
  async googleLogin(@Body() body: { credential: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const expectedAudience = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!expectedAudience) {
      throw new InternalServerErrorException('Missing GOOGLE_CLIENT_ID');
    }

    const credential = body?.credential?.trim();
    if (!credential) throw new UnauthorizedException('Missing Google credential');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    let info: any | null = null;
    try {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
      const tokenRes = await fetch(url, { signal: ctrl.signal });
      if (!tokenRes.ok) throw new UnauthorizedException('Invalid Google token');
      info = (await tokenRes.json());
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid Google token');
    } finally {
      clearTimeout(timer);
    }

    if (!info || typeof info !== 'object') throw new UnauthorizedException('Invalid Google token');
    if (info.aud !== expectedAudience) throw new UnauthorizedException('Invalid Google token audience');

    const email = typeof info.email === 'string' ? info.email.trim().toLowerCase() : '';
    const emailVerified = info.email_verified === true || String(info.email_verified).toLowerCase() === 'true';
    if (!email || !emailVerified) throw new UnauthorizedException('Google email not verified');

    let user = await this.userService.findByEmail(email);
    if (!user) {
      const autoCreate = (process.env.GOOGLE_AUTO_CREATE_USER ?? 'false').trim().toLowerCase() === 'true';
      if (!autoCreate) throw new UnauthorizedException('No local account for this email');
      user = await this.userService.createOauthUser(email, 'google');
    }

    if (this.mode() === 'jwt') {
      const accessToken = signAccessToken({ sub: String(user.id), email: user.email });
      const refreshToken = signRefreshToken({ sub: String(user.id), email: user.email });
      res.cookie(this.refreshCookieName(), refreshToken, this.refreshCookieOptions());
      return { id: String(user.id), email: user.email, accessToken };
    }

    req.session.userId = user.id;
    return { id: String(user.id), email: user.email };
  }

  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.mode() === 'jwt') {
      res.clearCookie(this.refreshCookieName(), this.refreshCookieOptions());
      return { ok: true };
    }
    try {
      req.session.destroy(() => {});
    } catch (err) {
      // ignore
    }

    res.clearCookie('connect.sid');
    res.clearCookie(this.refreshCookieName(), this.refreshCookieOptions());
    return { ok: true };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.mode() !== 'jwt') throw new UnauthorizedException();

    // Never cache auth state; caching can cause 304 + empty body and break refresh flows.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const token = this.readCookie(req, this.refreshCookieName());
    if (!token) throw new UnauthorizedException();
    let payload: { sub: string; email: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();

    const accessToken = signAccessToken({ sub: String(user.id), email: user.email });
    const nextRefresh = signRefreshToken({ sub: String(user.id), email: user.email });
    res.cookie(this.refreshCookieName(), nextRefresh, this.refreshCookieOptions());
    return { accessToken };
  }

  @Get('profile')
  async profile(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Never cache auth state; caching can cause 304 + empty body and break refresh flows.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (this.mode() === 'jwt') {
      const token = readBearerToken(req.headers.authorization);
      if (!token) throw new UnauthorizedException();
      let payload: { sub: string; email: string };
      try {
        payload = verifyAccessToken(token);
      } catch {
        throw new UnauthorizedException();
      }
      const user = await this.userService.findById(payload.sub);
      if (!user) throw new UnauthorizedException();
      return { id: String(user.id), email: user.email };
    }

    const userId = req.session.userId;
    if (!userId) throw new UnauthorizedException();
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return { id: String(user.id), email: user.email };
  }
}
