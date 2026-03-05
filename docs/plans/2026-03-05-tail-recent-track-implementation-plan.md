# Tail Number → Recent Flight Track Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Given a tail number (e.g. `N77GX`), fetch and display the most recent flight track departing in the last 48 hours and between `06:00–12:00` in `America/Chicago`.

**Architecture:** Add a NestJS backend endpoint that proxies FlightAware AeroAPI (`/flights/{ident}` then `/flights/{fa_flight_id}/track`), filters by the CST morning window, converts the track to GeoJSON, and returns it. Add a small frontend UI (Map Explorer) to input tail number, call the backend, and render the returned GeoJSON using existing `MapView`.

**Tech Stack:** NestJS (Node `fetch`), Jest; React + Vite + TypeScript; GeoJSON + react-leaflet.

---

### Task 1: Backend track module scaffold

**Files:**
- Create: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/track.module.ts`
- Create: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/track.controller.ts`
- Create: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/track.service.ts`
- Modify: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/app.module.ts`

**Step 1: Create minimal module/controller/service**
- Controller exposes `GET /track/recent-by-tail?tail=...` (no external calls yet), returns placeholder.

**Step 2: Add module to AppModule imports**
- Add `TrackModule` to `imports: []`.

**Step 3: Commit**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && git add src/app.module.ts src/track && git commit -m "feat(track): scaffold recent-by-tail endpoint"`

---

### Task 2: Backend time filtering utilities (TDD)

**Files:**
- Create: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/timeWindow.ts`
- Test: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/timeWindow.spec.ts`

**Step 1: Write the failing test**
Implement tests for:
- `isChicagoMorning(date, { start: "06:00", end: "12:00" })`
- Edge cases: exactly 06:00 is true, exactly 12:00 is false

```ts
import { isChicagoMorning } from './timeWindow';

describe('isChicagoMorning', () => {
  it('includes 06:00 and excludes 12:00 (America/Chicago)', () => {
    expect(isChicagoMorning('2026-03-05T12:00:00Z')).toBe(true);  // 06:00 CST (example)
    expect(isChicagoMorning('2026-03-05T18:00:00Z')).toBe(false); // 12:00 CST (example)
  });
});
```

**Step 2: Run test to verify it fails**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && npm test -- timeWindow.spec`
Expected: FAIL (module not found / function not implemented).

**Step 3: Write minimal implementation**
Implement `isChicagoMorning(isoString)` using `Intl.DateTimeFormat(..., { timeZone: "America/Chicago" }).formatToParts()` to extract local hour/minute.

**Step 4: Run test to verify it passes**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && npm test -- timeWindow.spec`
Expected: PASS.

**Step 5: Commit**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && git add src/track/timeWindow.ts src/track/timeWindow.spec.ts && git commit -m "test(track): add Chicago morning time window helper"`

---

### Task 3: Backend FlightAware client (TDD)

**Files:**
- Create: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/flightawareClient.ts`
- Test: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/flightawareClient.spec.ts`

**Step 1: Write failing test for request shape**
Mock `global.fetch` and assert:
- `x-apikey` header is sent
- URL path hits `/aeroapi/flights/${tail}?max_pages=1`

```ts
import { listFlightsByTail } from './flightawareClient';

it('calls AeroAPI flights by tail with x-apikey', async () => {
  (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '{"flights":[]}' });
  process.env.FLIGHTAWARE_API_KEY = 'k';
  await listFlightsByTail('N77GX');
  expect((global as any).fetch).toHaveBeenCalled();
});
```

**Step 2: Run test (fail)**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && npm test -- flightawareClient.spec`
Expected: FAIL.

**Step 3: Implement minimal client**
- Base URL: `https://aeroapi.flightaware.com/aeroapi`
- Parse response with `res.text()` then `JSON.parse` (match existing frontend pattern).
- Throw on missing `FLIGHTAWARE_API_KEY`.

**Step 4: Run test (pass)**

**Step 5: Commit**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && git add src/track/flightawareClient.ts src/track/flightawareClient.spec.ts && git commit -m "feat(track): add FlightAware AeroAPI client"`

---

### Task 4: Backend service: choose most recent matching flight + build GeoJSON (TDD)

**Files:**
- Modify: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/track.service.ts`
- Test: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/track.service.spec.ts`

**Step 1: Write failing tests**
Test scenarios:
- Filters to last 48 hours AND 06:00–12:00 America/Chicago
- Picks the most recent matching flight
- Converts track points → GeoJSON `Feature<LineString>` with `properties.id`

**Step 2: Run test (fail)**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && npm test -- track.service.spec`
Expected: FAIL.

**Step 3: Implement minimal logic**
- Validate tail (`/^[A-Z0-9-]{2,10}$/i`), normalize to upper.
- Call `listFlightsByTail(tail)` and filter by:
  - `depTime >= now - 48h`
  - `isChicagoMorning(depTimeISO)`
- Pick max `depTime`.
- Call `getTrackByFaFlightId(fa_flight_id)` and convert:
  - `coordinates: [ [lng, lat], ... ]`
- Optional: cache per tail for 5 minutes (simple in-memory `Map`).

**Step 4: Run test (pass)**

**Step 5: Commit**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && git add src/track/track.service.ts src/track/track.service.spec.ts && git commit -m "feat(track): implement recent morning track selection"`

---

### Task 5: Backend controller: wire up 200/400/404 responses (TDD)

**Files:**
- Modify: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/track.controller.ts`
- Test: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/track/track.controller.spec.ts`

**Step 1: Write failing controller test**
Use `@nestjs/testing` to create a module with only `TrackController` + `TrackService` mocked.
- Missing `tail` → 400
- Service returns null → 404
- Success → 200 + payload

**Step 2: Run test (fail)**

**Step 3: Implement controller**
- Use `@Query('tail') tail?: string`
- Throw `BadRequestException` on missing/empty
- Throw `NotFoundException` when no matching flight

**Step 4: Run test (pass)**

**Step 5: Commit**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && git add src/track/track.controller.ts src/track/track.controller.spec.ts && git commit -m "feat(track): return 400/404 for recent-by-tail"`

---

### Task 6: Frontend API client + Map Explorer UI

**Files:**
- Create: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training/src/lib/api/track.ts`
- Modify: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training/src/pages/MapExplorer/MapExplorer.tsx`

**Step 1: Add API client**
```ts
import { apiFetchWithRefresh } from './client';
import type { Feature, LineString } from 'geojson';

export type RecentTrackResponse = {
  tail: string;
  faFlightId: string;
  departureTimeISO: string;
  track: Feature<LineString>;
};

export function getRecentTrackByTail(tail: string) {
  return apiFetchWithRefresh<RecentTrackResponse>(`/track/recent-by-tail?tail=${encodeURIComponent(tail)}`);
}
```

**Step 2: Add UI to Map Explorer**
- Add input + button
- Local state: `tail`, `loading`, `error`, `remoteTrack?: TrackItem`
- When success: prepend `remoteTrack` into `tracks` list and set `selectedId` to its id so map fits bounds.

**Step 3: Manual verification**
Run frontend:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training && npm run dev`
Run backend:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && FLIGHTAWARE_API_KEY=... npm run start:dev`
Expected: entering `N77GX` shows a new polyline on the map (or a clear “not found” message).

**Step 4: Commit**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training && git add src/lib/api/track.ts src/pages/MapExplorer/MapExplorer.tsx && git commit -m "feat(map): fetch and render recent track by tail"`

---

### Task 7: Wire configuration docs

**Files:**
- Modify: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/README.md`

**Step 1: Add env var note**
- Document `FLIGHTAWARE_API_KEY`
- Document endpoint `GET /track/recent-by-tail`

**Step 2: Commit**
Run:
`cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && git add README.md && git commit -m "docs: document FlightAware recent track endpoint"`

