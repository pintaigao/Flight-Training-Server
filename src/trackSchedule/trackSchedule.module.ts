import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrackScheduleController } from './trackSchedule.controller';
import { TrackScheduleService } from './trackSchedule.service';

@Module({
  imports: [AuthModule],
  providers: [TrackScheduleService],
  controllers: [TrackScheduleController],
  exports: [TrackScheduleService],
})
export class TrackScheduleModule {}
