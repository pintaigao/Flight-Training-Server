import { Inject, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Context, Query, Resolver } from '@nestjs/graphql';
import type { Request } from 'express';
import { AuthGuard } from '../../auth/auth.guard';
import { FlightListItemType } from '../types/flight.type';
import { FLIGHT_QUERY, type FlightQuery } from '../graphql.tokens';

@Resolver(() => FlightListItemType)
@UseGuards(AuthGuard)
export class FlightsResolver {
  constructor(@Inject(FLIGHT_QUERY) private readonly flightQuery: FlightQuery) {}

  @Query(() => [FlightListItemType])
  flights(@Context('req') req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.flightQuery.findAllWithBestTrack(userId);
  }
}
