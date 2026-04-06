import { Controller, Post, Body, Get, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request } from 'express';
import { readBearerToken } from '../utils/jwt';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string; inviteCode: string }, @Req() req: Request) {
    this.requireServiceToken(req);

    const user = await this.authService.registerUser(body.email, body.password, body.inviteCode);
    if (!user) {
      throw new UnauthorizedException('Void Invitation');
    }

    const tokens = this.authService.issueTokens(user);
    return {
      id: String(user.id),
      email: user.email,
      ...tokens,
    };
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Req() req: Request) {
    this.requireServiceToken(req);

    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const tokens = this.authService.issueTokens(user);
    return {
      id: String(user.id),
      email: user.email,
      ...tokens,
    };
  }

  @Post('google')
  async googleLogin(@Body() body: { credential: string }, @Req() req: Request) {
    this.requireServiceToken(req);

    const user = await this.authService.loginWithGoogleCredential(String(body?.credential ?? ''));
    const tokens = this.authService.issueTokens(user);
    return {
      id: String(user.id),
      email: user.email,
      ...tokens,
    };
  }

  @Post('logout')
  logout(@Req() req: Request) {
    this.requireServiceToken(req);
    return { ok: true };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Body() body: { refreshToken?: string }) {
    this.requireServiceToken(req);

    const refreshToken = String(body?.refreshToken ?? '').trim();
    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    const refreshed = await this.authService.refreshTokens(refreshToken);
    return {
      id: String(refreshed.user.id),
      email: refreshed.user.email,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
    };
  }

  @Get('profile')
  async profile(@Req() req: Request) {
    this.requireServiceToken(req);

    const token = readBearerToken(req.headers.authorization);
    if (!token) throw new UnauthorizedException();

    const user = await this.authService.readProfile(token);
    return { id: String(user.id), email: user.email };
  }

  private requireServiceToken(req: Request) {
    const expected = String(process.env.BFF_SERVICE_TOKEN ?? '').trim();
    if (!expected) {
      return;
    }

    const actual = String(req.header('X-Service-Token') ?? '').trim();
    if (!actual || actual !== expected) {
      throw new UnauthorizedException();
    }
  }
}
