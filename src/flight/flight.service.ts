import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Flight } from './schemas/flight.schema';
import { FlightTrack, type TrackSource } from './schemas/flightTrack.schema';
import type { UpsertFlightDto } from './dto/flight.dto';
import type { UpsertFlightTrackDto } from './dto/track.dto';

const METERS_TO_FEET = 3.280839895013123;

function normalizeKmlMeta(meta: any | null) {
  if (!meta) return meta;
  // New shape: altRef=MSL, altSourceUnit=m. Old imports stored meters but labeled as feet.
  if (meta.altRef === 'MSL' && meta.altSourceUnit === 'm') return meta;
  if (meta.altRef !== 'AGL') return meta;

  const stats = meta?.stats;
  if (!stats) {
    return {
      ...meta,
      altRef: 'MSL',
      altUnit: 'ft',
      altSourceUnit: 'm',
      altSourceRef: 'MSL',
    };
  }

  const conv = (n: any) => (typeof n === 'number' && Number.isFinite(n) ? n * METERS_TO_FEET : n);

  return {
    ...meta,
    altRef: 'MSL',
    altUnit: 'ft',
    altSourceUnit: 'm',
    altSourceRef: 'MSL',
    stats: {
      ...stats,
      altMinFt: conv(stats.altMinFt),
      altMaxFt: conv(stats.altMaxFt),
    },
  };
}

@Injectable()
export class FlightService {
  constructor(
    @InjectRepository(Flight)
    @InjectRepository(FlightTrack)
    private flightRepo: Repository<Flight>,
    private flightTrackRepo: Repository<FlightTrack>,
  ) {}

  private async findOwnedFlight(userId: string, id: string) {
    return this.flightRepo.findOne({ where: { id, userId } });
  }

  async findAllWithBestTrack(userId: string) {
    const flights = await this.flightRepo.find({
      where: { userId },
      order: { dateISO: 'DESC' },
    });
    if (flights.length === 0) return [];

    const ids = flights.map((f) => f.id);
    const tracks = await this.flightTrackRepo.find({
      where: {
        flightId: In(ids),
      },
    });

    const byFlight = new Map<string, { fore?: FlightTrack; any?: FlightTrack }>();
    for (const t of tracks) {
      const cur = byFlight.get(t.flightId) ?? {};
      if (String(t.source) === 'FORE_FLIGHT') cur.fore = t;
      if (!cur.any || t.createdAt > cur.any.createdAt) cur.any = t;
      byFlight.set(t.flightId, cur);
    }

    return flights.map((f) => {
      const pair = byFlight.get(f.id);
      const best = pair?.fore ?? pair?.any ?? null;
      const meta = best?.rawFormat === 'kml' ? normalizeKmlMeta(best?.meta) : best?.meta;
      return {
        ...f,
        track: best?.feature ?? null,
        trackSource: best ? 'FORE_FLIGHT' : null,
        trackMeta: meta ?? null,
      };
    });
  }

  async upsertFlight(userId: string, id: string, dto: UpsertFlightDto) {
    const existing = await this.flightRepo.findOne({ where: { id } });
    if (existing && existing.userId !== userId) return null;
    const entity = this.flightRepo.create({
      ...(existing ?? { id }),
      userId,
      ...dto,
    });
    return this.flightRepo.save(entity);
  }

  async patchDescription(userId: string, id: string, description: string) {
    const flight = await this.findOwnedFlight(userId, id);
    if (!flight) return null;
    flight.description = description;
    const saved = await this.flightRepo.save(flight);
    return { id: saved.id, description: saved.description };
  }

  async patchComment(userId: string, id: string, comment: string) {
    const flight = await this.findOwnedFlight(userId, id);
    if (!flight) return null;
    flight.comments = comment;
    const saved = await this.flightRepo.save(flight);
    return { id: saved.id, comments: saved.comments };
  }

  async upsertTrack(userId: string, flightId: string, dto: UpsertFlightTrackDto) {
    const flight = await this.findOwnedFlight(userId, flightId);
    if (!flight) return null;
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
    userId: string,
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
    const flight = await this.findOwnedFlight(userId, flightId);
    if (!flight) return null;
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

  async getSamplesText(userId: string, flightId: string, source: TrackSource) {
    const flight = await this.findOwnedFlight(userId, flightId);
    if (!flight) return null;
    const row = await this.flightTrackRepo.findOne({
      where: { flightId, source },
      select: ['id', 'flightId', 'source', 'rawFormat', 'meta', 'samplesText', 'createdAt'],
    });
    if (row?.samplesText) return row;
    return this.flightTrackRepo.findOne({
      where: { flightId, samplesText: Not(IsNull()) },
      order: { createdAt: 'DESC' },
      select: ['id', 'flightId', 'source', 'rawFormat', 'meta', 'samplesText', 'createdAt'],
    });
  }

  async getTrack(userId: string, flightId: string, prefer: TrackSource = 'FORE_FLIGHT') {
    const flight = await this.findOwnedFlight(userId, flightId);
    if (!flight) return null;
    const first = await this.flightTrackRepo.findOne({
      where: { flightId, source: prefer },
    });
    if (first) return first;
    return this.flightTrackRepo.findOne({
      where: { flightId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteFlight(userId: string, id: string) {
    const flight = await this.findOwnedFlight(userId, id);
    if (!flight) return null;

    await this.flightTrackRepo.delete({ flightId: id });
    const res = await this.flightRepo.delete({ id, userId });
    return { deleted: res.affected ? res.affected > 0 : false };
  }
}
