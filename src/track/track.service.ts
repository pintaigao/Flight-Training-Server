import { Injectable } from '@nestjs/common';
import { getTrackByFaFlightId, listFlightsByTail } from './flightawareClient';
import { isChicagoMorning } from './timeWindow';

@Injectable()
export class TrackService {
  async getRecentByTail(tail: string, now = new Date()) {
    const list = await listFlightsByTail(tail);
    const flights: any[] = (list?.flights ?? list?.data?.flights ?? []) as any[];

    const nowMs = now.getTime();
    const windowStartMs = nowMs - 48 * 60 * 60 * 1000;

    let best: { faFlightId: string; depMs: number; depISO: string } | null = null;
    for (const f of flights) {
      const faFlightId = String(f?.fa_flight_id ?? f?.faFlightId ?? '');
      if (!faFlightId) continue;

      const depISO = pickDepartureISO(f);
      if (!depISO) continue;

      const depMs = new Date(depISO).getTime();
      if (Number.isNaN(depMs)) continue;
      if (depMs < windowStartMs || depMs > nowMs) continue;
      if (!isChicagoMorning(depISO)) continue;

      if (!best || depMs > best.depMs) best = { faFlightId, depMs, depISO };
    }

    if (!best) return null;

    const trackRes = await getTrackByFaFlightId(best.faFlightId);
    const points = normalizeTrackPoints(trackRes);
    const coordinates: [number, number][] = points.map((p) => toLngLat(p)).filter((x): x is [number, number] => !!x);

    return {
      tail,
      faFlightId: best.faFlightId,
      departureTimeISO: best.depISO,
      track: {
        type: 'Feature',
        properties: { id: `${tail}:${best.faFlightId}` },
        geometry: { type: 'LineString', coordinates },
      },
    };
  }
}

function pickDepartureISO(flight: any): string | null {
  const candidates = [flight?.departure_time, flight?.actual_departure_time, flight?.estimated_departure_time, flight?.scheduled_departure_time, flight?.filed_departure_time];
  for (const c of candidates) {
    const iso = coerceToISO(c);
    if (iso) return iso;
  }
  return null;
}

function coerceToISO(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  return null;
}

function normalizeTrackPoints(trackRes: any): any[] {
  if (!trackRes) return [];
  if (Array.isArray(trackRes)) return trackRes;
  if (Array.isArray(trackRes?.positions)) return trackRes.positions;
  if (Array.isArray(trackRes?.track)) return trackRes.track;
  if (Array.isArray(trackRes?.data)) return trackRes.data;
  return [];
}

function toLngLat(point: any): [number, number] | null {
  const lng = point?.longitude ?? point?.lon ?? point?.lng;
  const lat = point?.latitude ?? point?.lat;
  const nLng = typeof lng === 'string' ? Number(lng) : lng;
  const nLat = typeof lat === 'string' ? Number(lat) : lat;
  if (typeof nLng !== 'number' || typeof nLat !== 'number') return null;
  if (Number.isNaN(nLng) || Number.isNaN(nLat)) return null;
  return [nLng, nLat];
}
