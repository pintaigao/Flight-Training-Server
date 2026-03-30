import { FlightService } from './flight.service';

const gxTrackKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <Placemark>
      <name>Imported ADS-B Track</name>
      <description>Target: N12345</description>
      <gx:Track>
        <when>2026-03-29T14:00:00.000Z</when>
        <gx:coord>-87.9 41.9 304.8</gx:coord>
        <when>2026-03-29T14:30:00.000Z</when>
        <gx:coord>-87.8 42.0 365.8</gx:coord>
      </gx:Track>
    </Placemark>
  </Document>
</kml>`;

describe('FlightService importScheduledTrack', () => {
  it('creates a pending-edit flight and ADS-B track from a completed schedule export', async () => {
    const flightsById = new Map<string, any>();
    const flightRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        const flight = flightsById.get(where.id);
        if (!flight) return null;
        return flight.userId === where.userId ? flight : null;
      }),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        flightsById.set(value.id, value);
        return value;
      }),
    } as any;

    const flightTrackRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({
        id: 'track-1',
        createdAt: new Date('2026-03-29T14:31:00.000Z'),
        ...value,
      })),
    } as any;

    const service = new FlightService(flightRepo, flightTrackRepo);

    const result = await service.importScheduledTrack({
      userId: 'u1',
      scheduleId: 12,
      executionId: 34,
      displayName: 'N12345 practice area',
      targetType: 'tail',
      targetValue: 'N12345',
      rawKml: gxTrackKml,
      rawFilename: 'track-log.kml',
    });

    expect(flightRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'adsb-12-34',
        userId: 'u1',
        aircraftTail: 'N12345',
        from: 'TBD',
        to: 'TBD',
        tags: ['PENDING_EDIT'],
      }),
    );

    expect(flightTrackRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        flightId: 'adsb-12-34',
        source: 'ADSB_TRACK',
        rawFormat: 'kml',
        rawFilename: 'track-log.kml',
      }),
    );

    expect(result.flight.id).toBe('adsb-12-34');
    expect(result.flight.tags).toEqual(['PENDING_EDIT']);
    expect(result.track.source).toBe('ADSB_TRACK');
  });
});
