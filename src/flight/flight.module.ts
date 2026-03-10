import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flight } from './schemas/flight.schema';
import { FlightTrack } from './schemas/flightTrack.schema';
import { FlightService } from './flight.service';
import { FlightController } from './flight.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Flight, FlightTrack]), AuthModule],
  providers: [FlightService],
  controllers: [FlightController],
})
export class FlightModule {}
