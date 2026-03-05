import type { TrackSource } from '../schemas/flightTrack.schema';

export class UpsertFlightTrackDto {
  source: TrackSource;
  feature: any;
  meta?: any;
}

