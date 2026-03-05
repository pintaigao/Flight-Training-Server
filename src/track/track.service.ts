import { Injectable } from '@nestjs/common';

@Injectable()
export class TrackService {
  async getRecentByTail(tail: string) {
    return {
      tail,
      faFlightId: 'placeholder',
      departureTimeISO: new Date().toISOString(),
      track: {
        type: 'Feature',
        properties: { id: `${tail}:placeholder` },
        geometry: { type: 'LineString', coordinates: [] as [number, number][] },
      },
    };
  }
}

