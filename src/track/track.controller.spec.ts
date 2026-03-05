import { Test } from '@nestjs/testing';
import { TrackController } from './track.controller';
import { TrackService } from './track.service';

describe('TrackController', () => {
  it('exposes recent-by-tail endpoint', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TrackController],
      providers: [
        {
          provide: TrackService,
          useValue: {
            getRecentByTail: jest.fn(async () => ({
              tail: 'N77GX',
              faFlightId: 'demo',
              departureTimeISO: new Date('2026-01-15T14:00:00Z').toISOString(),
              track: {
                type: 'Feature',
                properties: { id: 'demo' },
                geometry: { type: 'LineString', coordinates: [[-122.1, 37.5]] },
              },
            })),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(TrackController);
    const res = await controller.getRecentByTail('N77GX');
    expect(res.tail).toBe('N77GX');
    expect(res.track.type).toBe('Feature');
  });
});
