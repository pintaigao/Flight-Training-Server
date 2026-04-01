import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { FlightService } from './flight.service';
import { ImportScheduledTrackDto } from './dto/importScheduledTrack.dto';

@Controller('flight/internal')
export class InternalFlightImportController {
  constructor(private readonly flightService: FlightService) {}

  @Post('track-schedule-import')
  importScheduledTrack(@Req() req: Request, @Body() dto: ImportScheduledTrackDto) {
    this.requireServiceToken(req);
    return this.flightService.importScheduledTrack(dto);
  }

  private requireServiceToken(req: Request) {
    const expected = String(process.env.ADSB_TRACKER_SERVICE_TOKEN ?? '').trim();
    if (!expected) {
      return;
    }

    const actual = String(req.header('X-Service-Token') ?? '').trim();
    if (!actual || actual !== expected) {
      throw new UnauthorizedException();
    }
  }
}
