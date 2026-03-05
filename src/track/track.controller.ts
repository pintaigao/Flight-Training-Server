import { Controller, Get, Query } from '@nestjs/common';
import { TrackService } from './track.service';

@Controller('track')
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @Get('recent-by-tail')
  getRecentByTail(@Query('tail') tail: string) {
    return this.trackService.getRecentByTail(tail);
  }
}

