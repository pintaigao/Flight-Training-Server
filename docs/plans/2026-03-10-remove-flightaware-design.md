# Remove FlightAware (Keep ForeFlight Upload Only) — Design

**Date:** 2026-03-10

## Goal

Remove all FlightAware-related code/HTTP endpoints/docs from the main backend. The system only supports uploading and reading ForeFlight tracks from the main service.

## Compatibility / API Behavior

- Keep existing query/body fields like `source` and `prefer` for compatibility.
- **Lenient (B):** any non-empty `source/prefer` value is accepted but ignored; the main service behaves as if the value was `FORE_FLIGHT`.
- The React app is updated to only use `FORE_FLIGHT` at the type level.

## Data Model

- Keep `flight_tracks` table and the `source` column.
- Main service only **writes** `source='FORE_FLIGHT'`.
- For **reads**:
  - Prefer `source='FORE_FLIGHT'` if present.
  - If not present, allow returning any existing `flight_tracks` row (for future microservice backfill), but the HTTP response reports `source/trackSource` as `FORE_FLIGHT` to keep the frontend types simple for now.

## What Gets Removed

- `TrackModule` and all `/track/*` endpoints.
- FlightAware client code and tests.
- Any branching logic that checks for FlightAware in flight controllers/services.
- Docs mentioning `FLIGHTAWARE_API_KEY` as a requirement.

## Future Microservice Hook (Not Implemented Now)

Later, a separate `flightaware-track-service` can be added. The main service (as gateway) would call it, then persist results into `flight_tracks` (e.g., `source='FLIGHTAWARE'`) so subsequent reads can use the cached data.

