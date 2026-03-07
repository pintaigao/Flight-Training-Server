import { getTrackByFaFlightId, listFlightsByTail } from './flightawareClient';

describe('flightawareClient', () => {
  beforeEach(() => {
    (global as any).fetch = undefined;
    delete process.env.FLIGHTAWARE_API_KEY;
  });

  it('calls AeroAPI flights by tail with x-apikey', async () => {
    process.env.FLIGHTAWARE_API_KEY = 'k';
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"flights":[]}',
    });

    await listFlightsByTail('N77GX');

    expect((global as any).fetch).toHaveBeenCalledWith(
      'https://aeroapi.flightaware.com/aeroapi/flights/N77GX?max_pages=1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-apikey': 'k' }),
      }),
    );
  });

  it('calls AeroAPI track by fa_flight_id with x-apikey', async () => {
    process.env.FLIGHTAWARE_API_KEY = 'k';
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"positions":[]}',
    });

    await getTrackByFaFlightId('fa123');

    expect((global as any).fetch).toHaveBeenCalledWith(
      'https://aeroapi.flightaware.com/aeroapi/flights/fa123/track',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-apikey': 'k' }),
      }),
    );
  });
});
