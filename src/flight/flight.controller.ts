import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Patch,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FlightService } from './flight.service';
import {
  PatchFlightCommentDto,
  PatchFlightDescriptionDto,
  UpsertFlightDto,
} from './dto/flight.dto';
import { UpsertFlightTrackDto } from './dto/track.dto';
import type { TrackSource } from './schemas/flightTrack.schema';
import { parseForeFlightKml } from './foreflightKml';

const METERS_TO_FEET = 3.280839895013123;

function normalizeKmlSamples(samples: any[], meta: any | null) {
  // Old imports stored meters in altAglFt (labeled as feet). Only convert those.
  if (!meta || meta.altRef !== 'AGL') return samples;
  return samples.map((s) => {
    const alt = s?.altAglFt;
    if (typeof alt !== 'number' || !Number.isFinite(alt)) return s;
    return { ...s, altAglFt: alt * METERS_TO_FEET };
  });
}

function sanitizeTrack(t: any) {
  if (!t) return t;
  const { rawText, samplesText, ...rest } = t;
  return rest;
}

@Controller('flight')
export class FlightController {
  constructor(private readonly flightService: FlightService) {}

  @Get()
  findAll() {
    return this.flightService.findAllWithBestTrack();
  }

  @Put(':id')
  async upsert(@Param('id') id: string, @Body() dto: UpsertFlightDto) {
    const normalized = String(id ?? '').trim();
    if (!normalized) throw new BadRequestException('id is required');
    return this.flightService.upsertFlight(normalized, dto);
  }

  @Patch(':id/description')
  async patchDescription(
    @Param('id') id: string,
    @Body() dto: PatchFlightDescriptionDto,
  ) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    if (!dto || typeof dto.description !== 'string')
      throw new BadRequestException('description is required');
    if (dto.description.length > 280)
      throw new BadRequestException('description is too long (max 280)');
    const res = await this.flightService.patchDescription(flightId, dto.description);
    if (!res) throw new NotFoundException('Flight not found');
    return res;
  }

  @Patch(':id/comment')
  async patchComment(@Param('id') id: string, @Body() dto: PatchFlightCommentDto) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    if (!dto || typeof dto.comment !== 'string')
      throw new BadRequestException('comment is required');
    const res = await this.flightService.patchComment(flightId, dto.comment);
    if (!res) throw new NotFoundException('Flight not found');
    return res;
  }

  @Put(':id/track')
  async upsertTrack(
    @Param('id') id: string,
    @Body() dto: UpsertFlightTrackDto,
  ) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    if (!dto?.source) throw new BadRequestException('source is required');
    if (!dto?.feature) throw new BadRequestException('feature is required');
    return this.flightService.upsertTrack(flightId, dto);
  }

  @Get(':id/track')
  async getTrack(@Param('id') id: string, @Query('prefer') prefer?: string) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    const preferred: TrackSource =
      prefer === 'FLIGHTAWARE' ? 'FLIGHTAWARE' : 'FORE_FLIGHT';
    const res = await this.flightService.getTrack(flightId, preferred);
    if (!res) throw new NotFoundException('No track found');
    return sanitizeTrack(res);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    return this.flightService.deleteFlight(flightId);
  }

  @Post(':id/track/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadTrack(
    @Param('id') id: string,
    @Query('source') source?: string,
    @UploadedFile()
    file?: {
      originalname?: string;
      mimetype?: string;
      buffer: Buffer;
    },
  ) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    if (!file) throw new BadRequestException('file is required');

    const src: TrackSource =
      source === 'FLIGHTAWARE' ? 'FLIGHTAWARE' : 'FORE_FLIGHT';
    const filename = file.originalname ?? null;
    const mime = file.mimetype ?? null;

    const text = file.buffer.toString('utf8');
    // For now, support ForeFlight KML gx:Track uploads. (GPX upload can be added later.)
    const parsed = parseForeFlightKml(text);
    parsed.feature.properties = {
      ...(parsed.feature.properties ?? {}),
      id: flightId,
    };

    const saved = await this.flightService.upsertTrackWithRaw(flightId, src, {
      feature: parsed.feature,
      meta: { ...(parsed.meta ?? {}), originalFilename: filename },
      rawText: text,
      rawFormat: 'kml',
      rawFilename: filename,
      rawMime: mime,
      samplesText: JSON.stringify(parsed.samples),
    });
    return sanitizeTrack(saved);
  }

  @Get(':id/track/samples')
  async getSamples(@Param('id') id: string, @Query('source') source?: string) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    const src: TrackSource =
      source === 'FLIGHTAWARE' ? 'FLIGHTAWARE' : 'FORE_FLIGHT';
    const row = await this.flightService.getSamplesText(flightId, src);
    if (!row?.samplesText) throw new NotFoundException('No samples found');
    let samples: any;
    try {
      samples = JSON.parse(row.samplesText);
    } catch {
      throw new BadRequestException('Invalid samples data');
    }
    if (Array.isArray(samples) && row.rawFormat === 'kml') {
      samples = normalizeKmlSamples(samples, row.meta ?? null);
    }
    return { flightId, source: src, samples, meta: row.meta ?? null };
  }
}
