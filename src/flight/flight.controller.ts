import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Patch, Param, Post, Put, Query, Req, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { FlightService } from './flight.service';
import { parseForeFlightKml } from './foreflightKml';
import { PatchFlightCommentDto, PatchFlightDescriptionDto, UpsertFlightDto } from './dto/flight.dto';
import { UpsertFlightTrackDto } from './dto/track.dto';
import type { Request } from 'express';
import type { TrackSource } from './schemas/flightTrack.schema';

const METERS_TO_FEET = 3.280839895013123;
const ALT_FT_MIN_VALID = -5_000;
const ALT_FT_MAX_VALID = 100_000;

function sanitizeAltFt(alt: unknown): number | null {
  if (typeof alt !== 'number' || !Number.isFinite(alt)) return null;
  if (alt < ALT_FT_MIN_VALID || alt > ALT_FT_MAX_VALID) return null;
  return alt;
}

function normalizeKmlSamples(samples: any[], meta: any | null) {
  // Old imports stored meters in altAglFt (labeled as feet). Only convert those.
  const converted =
    meta && meta.altRef === 'AGL'
      ? samples.map((s) => {
          const alt = s?.altAglFt;
          if (typeof alt !== 'number' || !Number.isFinite(alt)) return s;
          return { ...s, altAglFt: alt * METERS_TO_FEET };
        })
      : samples;

  // Defensive cleanup: strip sentinel/outlier altitudes so charts don't explode.
  return converted.map((s) => {
    const alt = sanitizeAltFt(s?.altAglFt);
    return alt === null ? { ...s, altAglFt: null } : s;
  });
}

function sanitizeTrack(t: any) {
  if (!t) return t;
  const { rawText: _rawText, samplesText: _samplesText, ...rest } = t;
  return rest;
}

@Controller('flight')
@UseGuards(AuthGuard)
export class FlightController {
  constructor(private readonly flightService: FlightService) {}

  @Get()
  findAll(@Req() req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.flightService.findAllWithBestTrack(userId);
  }

  // upsert: update + insert: 会先查有没有同 id 的 flight，有就更新，没有就创建再保存
  @Put(':id')
  async upsert(@Param('id') id: string, @Body() dto: UpsertFlightDto, @Req() req: Request) {
    const normalized = String(id ?? '').trim();
    if (!normalized) throw new BadRequestException('id is required');
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const saved = await this.flightService.upsertFlight(userId, normalized, dto);
    if (!saved) throw new NotFoundException('Flight not found');
    return saved;
  }

  @Patch(':id/description')
  async patchDescription(@Param('id') id: string, @Body() dto: PatchFlightDescriptionDto, @Req() req: Request) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    if (!dto || typeof dto.description !== 'string')
      throw new BadRequestException('description is required');
    if (dto.description.length > 280)
      throw new BadRequestException('description is too long (max 280)');
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const res = await this.flightService.patchDescription(userId, flightId, dto.description);
    if (!res) throw new NotFoundException('Flight not found');
    return res;
  }

  @Patch(':id/comment')
  async patchComment(@Param('id') id: string, @Body() dto: PatchFlightCommentDto, @Req() req: Request) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    if (!dto || typeof dto.comment !== 'string')
      throw new BadRequestException('comment is required');
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const res = await this.flightService.patchComment(userId, flightId, dto.comment);
    if (!res) throw new NotFoundException('Flight not found');
    return res;
  }

  //会先查有没有同 id 的 flight，有就更新，没有就创建再保存
  @Put(':id/track')
  async upsertTrack(@Param('id') id: string, @Body() dto: UpsertFlightTrackDto, @Req() req: Request) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    if (!dto?.source) throw new BadRequestException('source is required');
    if (!dto?.feature) throw new BadRequestException('feature is required');
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const saved = await this.flightService.upsertTrack(userId, flightId, dto);
    if (!saved) throw new NotFoundException('Flight not found');
    return saved;
  }

  @Get(':id/track')
  async getTrack(@Param('id') id: string, @Req() req: Request, @Query('prefer') prefer?: string) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    const preferred: TrackSource = prefer === 'FLIGHTAWARE' ? 'FLIGHTAWARE' : 'FORE_FLIGHT';
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const res = await this.flightService.getTrack(userId, flightId, preferred);
    if (!res) throw new NotFoundException('No track found');
    return sanitizeTrack(res);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const res = await this.flightService.deleteFlight(userId, flightId);
    if (!res) throw new NotFoundException('Flight not found');
    return res;
  }

  @Post(':id/track/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadTrack(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('source') source?: string,
    @UploadedFile()
    file?: { originalname?: string; mimetype?: string; buffer: Buffer },
  ) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    if (!file) throw new BadRequestException('file is required');

    const src: TrackSource = source === 'FLIGHTAWARE' ? 'FLIGHTAWARE' : 'FORE_FLIGHT';
    const filename = file.originalname ?? null;
    const mime = file.mimetype ?? null;

    const text = file.buffer.toString('utf8');
    // For now, support ForeFlight KML gx:Track uploads. (GPX upload can be added later.)
    const parsed = parseForeFlightKml(text);
    parsed.feature.properties = {
      ...(parsed.feature.properties ?? {}),
      id: flightId,
    };

    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const saved = await this.flightService.upsertTrackWithRaw(userId, flightId, src, {
      feature: parsed.feature,
      meta: { ...(parsed.meta ?? {}), originalFilename: filename },
      rawText: text,
      rawFormat: 'kml',
      rawFilename: filename,
      rawMime: mime,
      samplesText: JSON.stringify(parsed.samples),
    });
    if (!saved) throw new NotFoundException('Flight not found');
    return sanitizeTrack(saved);
  }

  @Get(':id/track/samples')
  async getSamples(@Param('id') id: string, @Req() req: Request, @Query('source') source?: string) {
    const flightId = String(id ?? '').trim();
    if (!flightId) throw new BadRequestException('id is required');
    const src: TrackSource = source === 'FLIGHTAWARE' ? 'FLIGHTAWARE' : 'FORE_FLIGHT';
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const row = await this.flightService.getSamplesText(userId, flightId, src);
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
