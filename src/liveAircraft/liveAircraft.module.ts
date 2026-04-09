import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LiveAircraftController } from './liveAircraft.controller';
import { LiveAircraftRateLimitGuard } from './liveAircraft.rateLimit.guard';
import { LiveAircraftService } from './liveAircraft.service';

@Module({
  imports: [AuthModule],
  controllers: [LiveAircraftController],
  providers: [LiveAircraftService, LiveAircraftRateLimitGuard],
})
export class LiveAircraftModule {}
