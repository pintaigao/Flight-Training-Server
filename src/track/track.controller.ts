import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TrackService } from './track.service';
import { SessionAuthGuard } from '../auth/sessionAuth.guard';

@Controller('track')
@UseGuards(SessionAuthGuard)
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @Get('recent-by-tail')
  async getRecentByTail(@Query('tail') tail: string) {
    const normalized = String(tail ?? '')
      .trim()
      .toUpperCase();
    if (!normalized) throw new BadRequestException('tail is required');

    const res = await this.trackService.getRecentByTail(normalized);
    if (!res) throw new NotFoundException('No matching flight found');
    return res;
  }
}
