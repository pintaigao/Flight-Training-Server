import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { LiveAircraftService } from './liveAircraft.service';
import { LiveAircraftRateLimitGuard } from './liveAircraft.rateLimit.guard';

@Controller('flights/live-aircraft')
@UseGuards(AuthGuard, LiveAircraftRateLimitGuard)
export class LiveAircraftController {
  constructor(private readonly liveAircraftService: LiveAircraftService) {}

  @Get()
  getSnapshot() {
    return this.liveAircraftService.getSnapshot();
  }
}
