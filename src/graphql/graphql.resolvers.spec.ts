import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FlightsResolver } from './resolvers/flights.resolver';
import { ProfileResolver } from './resolvers/profile.resolver';
import { FLIGHT_QUERY, USER_QUERY } from './graphql.tokens';

describe('GraphQL BFF resolvers', () => {
  it('profile throws Unauthorized without user', async () => {
    const modRef = await Test.createTestingModule({
      providers: [
        ProfileResolver,
        { provide: USER_QUERY, useValue: { findById: jest.fn() } },
      ],
    }).compile();

    const resolver = modRef.get(ProfileResolver);
    await expect(resolver.profile({} as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('flights throws Unauthorized without user', async () => {
    const modRef = await Test.createTestingModule({
      providers: [
        FlightsResolver,
        { provide: FLIGHT_QUERY, useValue: { findAllWithBestTrack: jest.fn() } },
      ],
    }).compile();

    const resolver = modRef.get(FlightsResolver);
    expect(() => resolver.flights({} as any)).toThrow(UnauthorizedException);
  });

  it('returns profile and flights for user', async () => {
    const userQuery = { findById: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' }) };
    const flightQuery = { findAllWithBestTrack: jest.fn().mockResolvedValue([{ id: 'f1' }]) };

    const modRef = await Test.createTestingModule({
      providers: [
        ProfileResolver,
        FlightsResolver,
        { provide: USER_QUERY, useValue: userQuery },
        { provide: FLIGHT_QUERY, useValue: flightQuery },
      ],
    }).compile();

    const profileResolver = modRef.get(ProfileResolver);
    const flightsResolver = modRef.get(FlightsResolver);

    const req = { user: { id: 'u1' } } as any;
    await expect(profileResolver.profile(req)).resolves.toEqual({ id: 'u1', email: 'a@b.com' });
    await expect(flightsResolver.flights(req)).resolves.toEqual([{ id: 'f1' }]);

    expect(userQuery.findById).toHaveBeenCalledWith('u1');
    expect(flightQuery.findAllWithBestTrack).toHaveBeenCalledWith('u1');
  });
});

