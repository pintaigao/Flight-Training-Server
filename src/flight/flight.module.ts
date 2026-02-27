import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flight } from './schemas/flight.schema';
import { FlightService } from './flight.service';
import { FlightController } from './flight.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Flight])],
  providers: [FlightService],
  controllers: [FlightController],
})
export class FlightModule {}
