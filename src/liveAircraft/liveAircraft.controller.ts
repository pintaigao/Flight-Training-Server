import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { LiveAircraftService } from './liveAircraft.service';

@Controller('flights/live-aircraft')
@UseGuards(AuthGuard)
export class LiveAircraftController {
  constructor(private readonly liveAircraftService: LiveAircraftService) {}

  @Get()
  getSnapshot() {
    return this.liveAircraftService.getSnapshot();
  }
}
