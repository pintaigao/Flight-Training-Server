import { TrackService } from './track.service';
import { getTrackByFaFlightId, listFlightsByTail } from './flightawareClient';

jest.mock('./flightawareClient', () => ({
  listFlightsByTail: jest.fn(),
  getTrackByFaFlightId: jest.fn(),
}));

describe('TrackService', () => {
  it('selects the most recent flight in last 48h and Chicago morning window', async () => {
    (listFlightsByTail as jest.Mock).mockResolvedValue({
      flights: [
        { fa_flight_id: 'a', departure_time: '2026-01-15T11:00:00Z' }, // 05:00 CST (exclude)
        { fa_flight_id: 'b', departure_time: '2026-01-15T12:30:00Z' }, // 06:30 CST
        { fa_flight_id: 'c', departure_time: '2026-01-15T16:00:00Z' }, // 10:00 CST (pick)
      ],
    });

    (getTrackByFaFlightId as jest.Mock).mockResolvedValue({
      positions: [
        { longitude: -122.1, latitude: 37.5 },
        { longitude: -122.2, latitude: 37.6 },
      ],
    });

    const svc = new TrackService();
    const now = new Date('2026-01-16T12:00:00Z'); // within 48h window
    const res = await svc.getRecentByTail('N77GX', now);

    expect(res?.tail).toBe('N77GX');
    expect(res?.faFlightId).toBe('c');
    expect(getTrackByFaFlightId).toHaveBeenCalledWith('c');
    expect(res?.track.geometry.coordinates).toEqual([
      [-122.1, 37.5],
      [-122.2, 37.6],
    ]);
    expect((res?.track.properties as any)?.id).toBe('N77GX:c');
  });

  it('returns null when no flight matches', async () => {
    (listFlightsByTail as jest.Mock).mockResolvedValue({ flights: [] });
    const svc = new TrackService();
    const res = await svc.getRecentByTail('N77GX', new Date('2026-01-16T12:00:00Z'));
    expect(res).toBeNull();
  });
});
