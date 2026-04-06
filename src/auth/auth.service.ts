import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../utils/jwt';

type AuthUserLike = {
  id: string | number;
  email: string;
};

@Injectable()
export class AuthService {
  constructor(private userService: UserService) {}

  async registerUser(email: string, password: string, inviteCode: string) {
    return this.userService.create(email, password, inviteCode);
  }

  async validateUser(email: string, pass: string) {
    return this.userService.validateUser(email, pass);
  }

  issueTokens(user: AuthUserLike) {
    return {
      accessToken: signAccessToken({ sub: String(user.id), email: user.email }),
      refreshToken: signRefreshToken({ sub: String(user.id), email: user.email }),
    };
  }

  async refreshTokens(refreshToken: string) {
    let payload: { sub: string; email: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      user,
      ...this.issueTokens(user),
    };
  }

  async readProfile(accessToken: string) {
    let payload: { sub: string; email: string };
    try {
      payload = verifyAccessToken(accessToken);
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  async loginWithGoogleCredential(credential: string) {
    const expectedAudience = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!expectedAudience) {
      throw new InternalServerErrorException('Missing GOOGLE_CLIENT_ID');
    }

    const normalizedCredential = credential.trim();
    if (!normalizedCredential) {
      throw new UnauthorizedException('Missing Google credential');
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    let info: any | null = null;
    try {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(normalizedCredential)}`;
      const tokenRes = await fetch(url, { signal: ctrl.signal });
      if (!tokenRes.ok) throw new UnauthorizedException('Invalid Google token');
      info = await tokenRes.json();
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
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

    return user;
  }
}
