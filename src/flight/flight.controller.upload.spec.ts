import { FlightController } from './flight.controller';

function sha256Hex(buf: Buffer) {
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHash('sha256').update(buf).digest('hex');
}

describe('FlightController uploadTrack', () => {
  it('ignores duplicate KML upload when sha256 matches', async () => {
    const fileBuf = Buffer.from('same-file');
    const rawSha256 = sha256Hex(fileBuf);

    const flightService = {
      getTrackBySource: jest.fn().mockResolvedValue({
        id: 't1',
        flightId: 'f1',
        source: 'FORE_FLIGHT',
        feature: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
        meta: { rawSha256 },
        rawFormat: 'kml',
        rawFilename: 'a.kml',
        rawMime: 'application/vnd.google-earth.kml+xml',
        createdAt: new Date(),
      }),
      upsertTrackWithRaw: jest.fn(),
    } as any;

    const c = new FlightController(flightService);

    const res = await c.uploadTrack(
      'f1',
      { user: { id: 'u1' } } as any,
      'FORE_FLIGHT',
      {
        originalname: 'a.kml',
        mimetype: 'application/vnd.google-earth.kml+xml',
        buffer: fileBuf,
      },
    );

    expect(flightService.getTrackBySource).toHaveBeenCalledWith('u1', 'f1', 'FORE_FLIGHT');
    expect(flightService.upsertTrackWithRaw).not.toHaveBeenCalled();
    expect(res?.id).toBe('t1');
  });
});

