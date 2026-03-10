import { BadRequestException, Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { UserService } from './user.service';
import { UpdatePasswordDto } from './dto/update-password.dto';

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('update-password')
  async updatePassword(@Body() body: UpdatePasswordDto, @Req() req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('missing user');

    const oldPassword = body?.oldPassword;
    const newPassword = body?.newPassword;
    const confirmNewPassword = body?.confirmNewPassword;

    if (!nonEmpty(oldPassword))
      throw new BadRequestException('oldPassword is required');
    if (!nonEmpty(newPassword))
      throw new BadRequestException('newPassword is required');
    if (!nonEmpty(confirmNewPassword))
      throw new BadRequestException('confirmNewPassword is required');
    if (newPassword !== confirmNewPassword)
      throw new BadRequestException('passwords do not match');

    const ok = await this.userService.changePassword(
      userId,
      oldPassword,
      newPassword,
    );
    if (!ok) throw new BadRequestException('oldPassword is incorrect');
    return { ok: true };
  }
}
