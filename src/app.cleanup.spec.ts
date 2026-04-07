import { existsSync } from 'node:fs';

describe('Flight-Training-Server direct frontend contract', () => {
  it('restores the browser-facing auth and tracking files', () => {
    expect(existsSync(`${__dirname}/auth/auth.guard.ts`)).toBe(true);
    expect(existsSync(`${__dirname}/utils/jwt.ts`)).toBe(true);
    expect(existsSync(`${__dirname}/utils/session.d.ts`)).toBe(true);
    expect(existsSync(`${__dirname}/liveAircraft/liveAircraft.module.ts`)).toBe(true);
    expect(existsSync(`${__dirname}/trackSchedule/trackSchedule.module.ts`)).toBe(true);
    expect(existsSync(`${__dirname}/user/user.controller.ts`)).toBe(true);
  });

  it('keeps GraphQL removed', () => {
    expect(existsSync(`${__dirname}/graphql/graphql.module.ts`)).toBe(false);
  });

  it('removes the old service request guard', () => {
    expect(existsSync(`${__dirname}/auth/service-request.guard.ts`)).toBe(false);
  });
});
