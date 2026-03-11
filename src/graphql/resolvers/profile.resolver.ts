import { Inject, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Context, Query, Resolver } from '@nestjs/graphql';
import type { Request } from 'express';
import { AuthGuard } from '../../auth/auth.guard';
import { ProfileType } from '../types/profile.type';
import { USER_QUERY, type UserQuery } from '../graphql.tokens';

@Resolver(() => ProfileType)
@UseGuards(AuthGuard)
export class ProfileResolver {
  constructor(@Inject(USER_QUERY) private readonly userQuery: UserQuery) {}

  @Query(() => ProfileType)
  async profile(@Context('req') req: Request): Promise<ProfileType> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const user = await this.userQuery.findById(userId);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email };
  }
}
