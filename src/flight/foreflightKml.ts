const GX_TRACK_RE = /<gx:Track\b[\s\S]*?<\/gx:Track>/i;
const WHEN_RE = /<when>([^<]+)<\/when>/gi;
const COORD_RE = /<gx:coord>([^<]+)<\/gx:coord>/gi;

const METERS_TO_FEET = 3.280839895013123;
// ForeFlight exports sometimes contain sentinel altitude values (e.g. -100000)
// to represent "unknown". Treat very low altitudes as missing to avoid
// destroying chart scales.
const ALT_METERS_MIN_VALID = -10_000;

function inBox(lat: number, lng: number, box: { latMin: number; latMax: number; lngMin: number; lngMax: number }) {
  return lat >= box.latMin && lat <= box.latMax && lng >= box.lngMin && lng <= box.lngMax;
}

// Heuristic mapping for US time zones based on lat/lng.
// Returns IANA zone name (e.g. America/Chicago) or null if unknown.
function guessUsTimeZoneFromLatLng(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const US_BOUNDS = { latMin: 18, latMax: 72, lngMin: -171, lngMax: -50 };
  if (!inBox(lat, lng, US_BOUNDS)) return null;

  // Hawaii
  if (inBox(lat, lng, { latMin: 18, latMax: 23.5, lngMin: -161, lngMax: -154 })) return 'Pacific/Honolulu';

  // Alaska (rough, excludes Aleutians edge cases)
  if (inBox(lat, lng, { latMin: 51, latMax: 72, lngMin: -170, lngMax: -129 })) return 'America/Anchorage';

  // Phoenix keeps MST year-round; rough AZ box.
  if (inBox(lat, lng, { latMin: 31, latMax: 37.5, lngMin: -115, lngMax: -108.8 })) return 'America/Phoenix';

  // Longitude-based fallback across the lower 48.
  if (lng <= -114) return 'America/Los_Angeles';
  if (lng <= -101) return 'America/Denver';
  if (lng <= -87) return 'America/Chicago';
  return 'America/New_York';
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function downsampleKeepEnds<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  if (max < 2) return [arr[0]];
  const out: T[] = [];
  const step = (arr.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * step);
    out.push(arr[idx]);
  }
  out[0] = arr[0];
  out[out.length - 1] = arr[arr.length - 1];
  return out;
}

export type ParsedForeFlightKml = {
  startTimeISO: string;
  endTimeISO: string;
  pointCount: number;
  feature: {
    type: 'Feature';
    properties: Record<string, any>;
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  };
  meta: any;
  samples: {
    t: string;
    lng: number;
    lat: number;
    altAglFt: number | null;
    gsKt: number | null;
  }[];
};

/**
 * Parses ForeFlight KML <gx:Track> into a GeoJSON LineString and meta.
 *
 * ForeFlight KML gx:coord altitude is in meters (MSL). We convert to feet (MSL).
 * Speed is computed as ground speed in knots.
 */
export function parseForeFlightKml(text: string): ParsedForeFlightKml {
  const m = text.match(GX_TRACK_RE);
  if (!m) throw new Error('No gx:Track found');
  const trackXml = m[0];

  const whens: string[] = [];
  let wm: RegExpExecArray | null;
  while ((wm = WHEN_RE.exec(trackXml))) {
    const t = String(wm[1] ?? '').trim();
    if (!t) continue;
    const iso = new Date(t).toISOString();
    whens.push(iso);
  }

  const coords: { lng: number; lat: number; altAglFt: number | null }[] = [];
  let cm: RegExpExecArray | null;
  while ((cm = COORD_RE.exec(trackXml))) {
    const raw = String(cm[1] ?? '').trim();
    if (!raw) continue;
    const parts = raw.split(/\s+/);
    if (parts.length < 2) continue;
    const lng = Number(parts[0]);
    const lat = Number(parts[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const altMeters = parts.length >= 3 ? Number(parts[2]) : NaN;
    const altAglFt = Number.isFinite(altMeters) && altMeters > ALT_METERS_MIN_VALID ? altMeters * METERS_TO_FEET : null;
    coords.push({ lng, lat, altAglFt });
  }

  const count = Math.min(whens.length, coords.length);
  if (count < 2) throw new Error('Not enough track points');

  const startTimeISO = whens[0];
  const endTimeISO = whens[count - 1];
  const departureTimeZone = guessUsTimeZoneFromLatLng(coords[0].lat, coords[0].lng);

  // compute per-point samples + stats
  let altMinFt: number | null = null;
  let altMaxFt: number | null = null;
  let gsMaxKt: number | null = null;
  let gsSumKt = 0;
  let gsCount = 0;

  const samples: {
    t: string;
    lng: number;
    lat: number;
    altAglFt: number | null;
    gsKt: number | null;
  }[] = [];
  for (let i = 0; i < count; i++) {
    const c = coords[i];
    const t = whens[i];
    if (!t) continue;
    const s = {
      t,
      lng: c.lng,
      lat: c.lat,
      altAglFt: c.altAglFt,
      gsKt: null as number | null,
    };
    if (typeof c.altAglFt === 'number') {
      altMinFt = altMinFt == null ? c.altAglFt : Math.min(altMinFt, c.altAglFt);
      altMaxFt = altMaxFt == null ? c.altAglFt : Math.max(altMaxFt, c.altAglFt);
    }
    if (i !== 0) {
      const prevT = new Date(whens[i - 1]).getTime();
      const curT = new Date(whens[i]).getTime();
      const dtSec = (curT - prevT) / 1000;
      if (Number.isFinite(dtSec) && dtSec > 0) {
        const distM = haversineMeters(coords[i - 1], c);
        const kt = (distM / dtSec) * 1.9438444924406;
        if (Number.isFinite(kt)) {
          s.gsKt = kt;
          gsMaxKt = gsMaxKt == null ? kt : Math.max(gsMaxKt, kt);
          gsSumKt += kt;
          gsCount += 1;
        }
      }
    }
    samples.push(s);
  }

  const gsAvgKt = gsCount ? gsSumKt / gsCount : null;

  // For map rendering, bound geometry size (no UI limit; this is internal rendering optimization)
  const MAX_COORDS = 20000;
  const line = downsampleKeepEnds(
    coords.slice(0, count).map((p) => [p.lng, p.lat] as [number, number]),
    MAX_COORDS,
  );

  return {
    startTimeISO,
    endTimeISO,
    pointCount: count,
    feature: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: line },
    },
    meta: {
      altRef: 'MSL',
      altUnit: 'ft',
      altSourceUnit: 'm',
      altSourceRef: 'MSL',
      speedUnit: 'kt',
      departureTimeZone,
      startTimeISO,
      endTimeISO,
      pointCount: count,
      stats: { altMinFt, altMaxFt, gsMaxKt, gsAvgKt },
    },
    samples,
  };
}
