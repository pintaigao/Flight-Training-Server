import { parseForeFlightKml } from './foreflightKml';

describe('parseForeFlightKml', () => {
  it('converts altitude meters to feet', () => {
    const kml = `
      <kml>
        <gx:Track>
          <when>2025-01-01T00:00:00Z</when>
          <when>2025-01-01T00:00:10Z</when>
          <gx:coord>-122.1000 37.5000 100</gx:coord>
          <gx:coord>-122.2000 37.6000 200</gx:coord>
        </gx:Track>
      </kml>
    `;

    const parsed = parseForeFlightKml(kml);
    expect(parsed.samples[0]?.altAglFt).toBeCloseTo(328.0839895, 6);
    expect(parsed.samples[1]?.altAglFt).toBeCloseTo(656.167979, 6);

    expect(parsed.meta.altRef).toBe('MSL');
    expect(parsed.meta.altUnit).toBe('ft');
    expect(parsed.meta.altSourceUnit).toBe('m');
    expect(parsed.meta.altSourceRef).toBe('MSL');
    expect(parsed.meta.departureTimeZone).toBe('America/Los_Angeles');

    const stats = parsed.meta?.stats;
    expect(stats.altMinFt).toBeCloseTo(328.0839895, 6);
    expect(stats.altMaxFt).toBeCloseTo(656.167979, 6);
  });
});
