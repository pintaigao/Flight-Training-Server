import { LiveAircraftService } from './liveAircraft.service';

describe('LiveAircraftService', () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.ADSB_TRACKER_BASE_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalBaseUrl == null) {
      delete process.env.ADSB_TRACKER_BASE_URL;
    } else {
      process.env.ADSB_TRACKER_BASE_URL = originalBaseUrl;
    }
    jest.restoreAllMocks();
  });

  it('requests the live-aircraft snapshot from the ADSB tracker service', async () => {
    process.env.ADSB_TRACKER_BASE_URL = 'http://tracker.test:5053';

    const payload = {
      updatedAt: '2026-03-29T18:10:00Z',
      count: 1,
      items: [{ hex: 'a20a1f', flight: 'SWA3891', seen: 0.1 }],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(payload),
    } as any);

    const service = new LiveAircraftService();
    await expect(service.getSnapshot()).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://tracker.test:5053/api/v1/adsb/flights/live-aircraft',
      { method: 'GET' },
    );
  });
});
