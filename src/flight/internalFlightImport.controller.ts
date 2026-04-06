import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { FlightService } from './flight.service';
import { ImportScheduledTrackDto } from './dto/importScheduledTrack.dto';

@Controller('flight/internal')
export class InternalFlightImportController {
  constructor(private readonly flightService: FlightService) {}

  // 从 ADSB Server 导入 KML（当 Schedule Monitor 结束的时候）（通常是 ADSB 检测到 Schedule 结束后生成 KML 并 call 这个 api 传回 KML）
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
