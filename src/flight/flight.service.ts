import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Flight } from './schemas/flight.schema';
import { FlightTrack, type TrackSource } from './schemas/flightTrack.schema';
import type { UpsertFlightDto } from './dto/flight.dto';
import type { UpsertFlightTrackDto } from './dto/track.dto';

@Injectable()
export class FlightService {
  constructor(
    @InjectRepository(Flight)
    private flightRepo: Repository<Flight>,
    @InjectRepository(FlightTrack)
    private flightTrackRepo: Repository<FlightTrack>,
  ) {}

  async findAllWithBestTrack() {
    const flights = await this.flightRepo.find({ order: { dateISO: 'DESC' } });
    if (flights.length === 0) return [];

    const ids = flights.map((f) => f.id);
    const tracks = await this.flightTrackRepo.find({
      where: {
        flightId: In(ids),
        source: In(['FORE_FLIGHT', 'FLIGHTAWARE'] as TrackSource[]),
      },
    });

    const byFlight = new Map<
      string,
      { fore?: FlightTrack; fa?: FlightTrack }
    >();
    for (const t of tracks) {
      const cur = byFlight.get(t.flightId) ?? {};
      if (t.source === 'FORE_FLIGHT') cur.fore = t;
      if (t.source === 'FLIGHTAWARE') cur.fa = t;
      byFlight.set(t.flightId, cur);
    }

    return flights.map((f) => {
      const pair = byFlight.get(f.id);
      const best = pair?.fore ?? pair?.fa ?? null;
      return {
        ...f,
        track: best?.feature ?? null,
        trackSource: best?.source ?? null,
        trackMeta: best?.meta ?? null,
      };
    });
  }

  async upsertFlight(id: string, dto: UpsertFlightDto) {
    const existing = await this.flightRepo.findOne({ where: { id } });
    const entity = this.flightRepo.create({
      ...(existing ?? { id }),
      ...dto,
    });
    return this.flightRepo.save(entity);
  }

  async upsertTrack(flightId: string, dto: UpsertFlightTrackDto) {
    const existing = await this.flightTrackRepo.findOne({
      where: { flightId, source: dto.source },
    });
    const entity = this.flightTrackRepo.create({
      ...(existing ?? { flightId, source: dto.source }),
      feature: dto.feature,
      meta: dto.meta ?? null,
      rawText: null,
      rawFormat: null,
      rawFilename: null,
      rawMime: null,
      samplesText: null,
    });
    return this.flightTrackRepo.save(entity);
  }

  async upsertTrackWithRaw(
    flightId: string,
    source: TrackSource,
    payload: {
      feature: any;
      meta: any;
      rawText: string;
      rawFormat: string;
      rawFilename: string | null;
      rawMime: string | null;
      samplesText: string | null;
    },
  ) {
    const existing = await this.flightTrackRepo.findOne({
      where: { flightId, source },
    });
    const entity = this.flightTrackRepo.create({
      ...(existing ?? { flightId, source }),
      feature: payload.feature,
      meta: payload.meta ?? null,
      rawText: payload.rawText,
      rawFormat: payload.rawFormat,
      rawFilename: payload.rawFilename,
      rawMime: payload.rawMime,
      samplesText: payload.samplesText,
    });
    return this.flightTrackRepo.save(entity);
  }

  async getSamplesText(flightId: string, source: TrackSource) {
    return this.flightTrackRepo.findOne({
      where: { flightId, source },
      select: ['id', 'flightId', 'source', 'samplesText', 'createdAt'],
    });
  }

  async getTrack(flightId: string, prefer: TrackSource = 'FORE_FLIGHT') {
    const first = await this.flightTrackRepo.findOne({
      where: { flightId, source: prefer },
    });
    if (first) return first;
    const fallback: TrackSource =
      prefer === 'FORE_FLIGHT' ? 'FLIGHTAWARE' : 'FORE_FLIGHT';
    return this.flightTrackRepo.findOne({
      where: { flightId, source: fallback },
    });
  }

  async deleteFlight(id: string) {
    await this.flightTrackRepo.delete({ flightId: id });
    const res = await this.flightRepo.delete({ id });
    return { deleted: res.affected ? res.affected > 0 : false };
  }
}
