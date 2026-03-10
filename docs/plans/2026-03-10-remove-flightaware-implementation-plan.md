# Remove FlightAware (Keep ForeFlight Upload Only) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Delete FlightAware/track lookup module from the main backend, keep only ForeFlight uploads, and update the React app types/APIs accordingly.

**Architecture:** The main service becomes ForeFlight-only for writes and ignores `source/prefer` inputs (lenient compatibility). Reads prefer `FORE_FLIGHT` but may fall back to any cached `flight_tracks` row (future microservice backfill), while reporting `FORE_FLIGHT` to the client.

**Tech Stack:** NestJS, TypeORM, Jest, React + TS.

---

### Task 1: Remove TrackModule and FlightAware code

**Files:**
- Modify: `src/app.module.ts`
- Delete: `src/track/flightawareClient.ts`
- Delete: `src/track/flightawareClient.spec.ts`
- Delete: `src/track/track.controller.ts`
- Delete: `src/track/track.controller.spec.ts`
- Delete: `src/track/track.service.ts`
- Delete: `src/track/track.service.spec.ts`
- Delete: `src/track/track.module.ts`

**Step 1: Delete the track module directory**

Run: `rm -rf src/track`

Expected: `src/track` no longer exists.

**Step 2: Remove TrackModule import/usage**

Edit `src/app.module.ts` to remove `TrackModule` from imports.

**Step 3: Run backend tests**

Run: `npm test`

Expected: PASS (or only failures directly related to removed track module).

**Step 4: Commit**

Run:
- `git add -A`
- `git commit -m "refactor: remove track module"`

---

### Task 2: Make flight track reads/writes ForeFlight-only (lenient inputs)

**Files:**
- Modify: `src/flight/schemas/flightTrack.schema.ts`
- Modify: `src/flight/flight.controller.ts`
- Modify: `src/flight/flight.service.ts`

**Step 1: Write/adjust failing tests (if any)**

If there are tests covering track preference, update them so:
- `prefer` is ignored
- `source` is ignored and stored as `FORE_FLIGHT`

**Step 2: Update `TrackSource` type**

In `src/flight/schemas/flightTrack.schema.ts`, restrict `TrackSource` to `FORE_FLIGHT` only (do not remove DB column).

**Step 3: Controller: normalize inputs**

In `src/flight/flight.controller.ts`:
- `GET :id/track`: ignore `prefer`; always call service with `FORE_FLIGHT`.
- `POST :id/track/upload`: ignore `source`; always store as `FORE_FLIGHT`.
- `GET :id/track/samples`: ignore `source`; always fetch `FORE_FLIGHT` first.
- `PUT :id/track`: require `dto.source` exists for compatibility but overwrite to `FORE_FLIGHT` before saving.

**Step 4: Service: remove source branching**

In `src/flight/flight.service.ts`:
- `findAllWithBestTrack`: query all tracks for the user’s flights; pick the `FORE_FLIGHT` track if present, otherwise pick any one (prefer newest by `createdAt`).
- `getTrack`: try `FORE_FLIGHT`, then fall back to any track (prefer newest by `createdAt`).
- `getSamplesText`: try `FORE_FLIGHT` samples, then fall back to any track with `samplesText` (prefer newest by `createdAt`).
- For all responses, set `trackSource` to `FORE_FLIGHT` when a track exists.

**Step 5: Run backend tests**

Run: `npm test`

Expected: PASS.

**Step 6: Commit**

Run:
- `git add -A`
- `git commit -m "refactor: make flight tracks foreflight-only"`

---

### Task 3: Remove FlightAware references from backend docs

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-05-tail-recent-track-design.md`
- Modify: `docs/plans/2026-03-05-tail-recent-track-implementation-plan.md`

**Step 1: Remove `FLIGHTAWARE_API_KEY` mentions**

Update docs to reflect FlightAware removal.

**Step 2: Commit**

Run:
- `git add -A`
- `git commit -m "docs: remove FlightAware references"`

---

### Task 4: React app — remove FlightAware types and unused track API

**Files:**
- Modify: `../Flight-Training/src/lib/api/flight.api.ts`
- Modify: `../Flight-Training/src/store/flights/types.ts`
- Delete: `../Flight-Training/src/lib/api/track.api.ts`

**Step 1: Narrow track source types**

Change unions so only `FORE_FLIGHT` remains.

**Step 2: Delete unused `/track/*` client**

Remove `../Flight-Training/src/lib/api/track.api.ts` and any dead imports (if present).

**Step 3: Build React**

Run: `cd ../Flight-Training && npm run build`

Expected: PASS.

**Step 4: Commit**

Run:
- `git add -A`
- `git commit -m "refactor: remove FlightAware from react"`

