import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LiveAircraftController } from './liveAircraft.controller';
import { LiveAircraftService } from './liveAircraft.service';

@Module({
  imports: [AuthModule],
  controllers: [LiveAircraftController],
  providers: [LiveAircraftService],
})
export class LiveAircraftModule {}
