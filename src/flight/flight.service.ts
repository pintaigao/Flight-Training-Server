import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flight } from './schemas/flight.schema';
import { Comment } from './dto/comments.dto';

@Injectable()
export class FlightService {
  constructor(
    @InjectRepository(Flight)
    private flightRepo: Repository<Flight>,
  ) {}

  createComment(dto: Comment) {
    const flight = this.flightRepo.create(dto);
    return this.flightRepo.save(flight);
  }

  findAll() {
    return this.flightRepo.find();
  }
}
