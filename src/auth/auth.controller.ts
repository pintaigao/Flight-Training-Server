import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Post('register')
  async register(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
  ) {
    const user = await this.userService.create(body.email, body.password);
    req.session.userId = user.id;
    return { id: String(user.id), email: user.email };
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Req() req: Request) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    req.session.userId = user.id;
    return { id: String(user.id), email: user.email };
  }

  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      req.session.destroy(() => {});
    } catch {
      // ignore
    }
    res.clearCookie('connect.sid');
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const userId = req.session.userId;
    if (!userId) throw new UnauthorizedException();
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return { id: String(user.id), email: user.email };
  }
}
