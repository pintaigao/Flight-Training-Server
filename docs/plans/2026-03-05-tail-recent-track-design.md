# Tail Number → Recent Flight Track (06:00–12:00 CST, last 48h)

## Summary
Add a feature where a user enters an aircraft tail number (e.g. `N77GX`) and the app fetches the most recent flight track that:

- Departed within the last 48 hours, and
- Has a departure time between `06:00` (inclusive) and `12:00` (exclusive) in **CST/CDT as `America/Chicago`**

The track is displayed on the existing frontend map.

## Background / Constraints
- The original desire is “tail number → track via OpenSky”, but OpenSky track history is typically keyed by `icao24`, not tail number.
- This design uses **FlightAware AeroAPI** as the near-term track provider (and to avoid tail→icao24 resolution issues), with a note for a future OpenSky swap once `icao24` is available.

## Goals
- Single input: tail number.
- Output: the most recent matching flight track (as a map polyline).
- Do not expose third-party API keys to the browser.
- Provide clear “not found” vs “error” UX.

## Non-goals
- Persisting fetched tracks to the database.
- Supporting arbitrary time windows beyond “last 48h” and “06:00–12:00 America/Chicago”.
- Multi-flight selection UI (only the “most recent” match).

## Architecture

### Backend (NestJS) — proxy + filtering
Add a new endpoint that:
1) Calls FlightAware AeroAPI `GET /flights/{ident}` with `{ident}` = tail number.
2) Filters flights by:
   - Departure time within the last 48 hours (relative to server time), and
   - Departure time local-to-`America/Chicago` within `06:00–12:00`
3) Chooses the most recent matching flight.
4) Calls `GET /flights/{fa_flight_id}/track` to get the track points.
5) Converts points to GeoJSON `Feature<LineString>` and returns it to the frontend.

### Frontend (React) — input + map overlay
- Add a simple UI (recommended location: **Map Explorer**) to enter a tail number and trigger fetch.
- Display the returned GeoJSON line using existing `MapView` support for tracks.
- Keep the fetched track ephemeral (in-memory UI state), not persisted to localStorage.

## API Contract

### Request
`GET /track/recent-by-tail?tail=N77GX`

### Response (200)
```json
{
  "tail": "N77GX",
  "faFlightId": "string",
  "departureTimeISO": "2026-03-05T14:30:00Z",
  "track": {
    "type": "Feature",
    "properties": { "id": "N77GX:fa_flight_id" },
    "geometry": { "type": "LineString", "coordinates": [[-87.63, 41.88], ...] }
  }
}
```

### Not found (404)
```json
{ "message": "No matching flight found in the last 48 hours for 06:00–12:00 America/Chicago." }
```

## Filtering Rules (CST window)
- Timezone: `America/Chicago` (handles CST/CDT automatically).
- Window: `06:00 <= localTime < 12:00`.
- “Departure time” field selection:
  - Prefer actual off-block / takeoff if present, else estimated, else scheduled.
  - If no usable departure timestamp exists for a flight, exclude it.

## Configuration / Secrets
- Backend env: `FLIGHTAWARE_API_KEY`
- No FlightAware calls from the browser.

## Error Handling
- 401/403 from FlightAware: return 502 with a generic message (do not leak details).
- Rate limit (429): return 503 + “try again later”.
- Invalid tail input: return 400.

## Security
- Require existing auth session (same as other app features) before allowing the endpoint.
- Add basic server-side throttling and short TTL cache (e.g. 5 minutes per tail) to protect API quota.

## Testing
- Backend unit tests:
  - Time window filtering (edge cases at 06:00 and 12:00).
  - Selection of “most recent matching” flight.
  - Track-to-GeoJSON conversion.
- Frontend:
  - Component renders loading/error states.
  - Map shows a track when API returns success.

## Future: OpenSky integration
If/when `icao24` becomes available (via a maintained mapping or a reliable provider), swap the “track provider” layer:
- Keep the same backend endpoint and GeoJSON response shape.
- Replace the `fa_flight_id` track call with an OpenSky track call keyed by `icao24` and timestamps.

