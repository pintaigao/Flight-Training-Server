const AEROAPI_BASE = 'https://aeroapi.flightaware.com/aeroapi';

export type AeroApiResponse = any;

function requireApiKey(): string {
  const key = process.env.FLIGHTAWARE_API_KEY;
  if (!key) throw new Error('Missing FLIGHTAWARE_API_KEY');
  return key;
}

async function aeroFetch(path: string): Promise<AeroApiResponse> {
  const key = requireApiKey();
  const res = await fetch(`${AEROAPI_BASE}${path}`, {
    headers: {
      'x-apikey': key,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `AeroAPI error ${res.status}: ${text || '(empty response)'}`,
    );
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function listFlightsByTail(
  tail: string,
): Promise<AeroApiResponse> {
  return aeroFetch(`/flights/${encodeURIComponent(tail)}?max_pages=1`);
}

export async function getTrackByFaFlightId(
  faFlightId: string,
): Promise<AeroApiResponse> {
  return aeroFetch(`/flights/${encodeURIComponent(faFlightId)}/track`);
}
