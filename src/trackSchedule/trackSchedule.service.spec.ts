import { TrackScheduleService } from './trackSchedule.service';

describe('TrackScheduleService archive', () => {
  it('posts archive request to ADSB tracker service', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: jest.fn(),
      text: jest.fn().mockResolvedValue(''),
    });

    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    try {
      const service = new TrackScheduleService();
      await service.archive('u1', '42');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5053/adsb/flights/track-schedules/42/archive',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-User-Id': 'u1',
          }),
        }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
