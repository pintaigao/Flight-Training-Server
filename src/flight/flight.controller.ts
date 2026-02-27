import { Body, Controller, Get, Post } from '@nestjs/common';
import { FlightService } from './flight.service';
import { Comment } from './dto/comments.dto';

@Controller('flight')
export class FlightController {
  constructor(private readonly flightService: FlightService) {}

  @Post('comment')
  create(@Body() dto: Comment) {
    return this.flightService.createComment(dto);
  }

  @Get()
  findAll() {
    return this.flightService.findAll();
  }
}
