import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { TrackScheduleService } from './trackSchedule.service';
import type { CreateTrackScheduleDto } from './dto/trackSchedule.dto';

@Controller('flights/track-schedules')
@UseGuards(AuthGuard)
export class TrackScheduleController {
  constructor(private readonly trackScheduleService: TrackScheduleService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateTrackScheduleDto) {
    return this.trackScheduleService.create(this.requireUserId(req), dto);
  }

  @Get()
  list(@Req() req: Request) {
    return this.trackScheduleService.list(this.requireUserId(req));
  }

  @Get(':id')
  getById(@Req() req: Request, @Param('id') id: string) {
    const scheduleId = String(id ?? '').trim();
    if (!scheduleId) throw new BadRequestException('id is required');
    return this.trackScheduleService.getById(this.requireUserId(req), scheduleId);
  }

  @Post(':id/cancel')
  cancel(@Req() req: Request, @Param('id') id: string) {
    const scheduleId = String(id ?? '').trim();
    if (!scheduleId) throw new BadRequestException('id is required');
    return this.trackScheduleService.cancel(this.requireUserId(req), scheduleId);
  }

  @Get(':id/executions')
  listExecutions(@Req() req: Request, @Param('id') id: string) {
    const scheduleId = String(id ?? '').trim();
    if (!scheduleId) throw new BadRequestException('id is required');
    return this.trackScheduleService.listExecutions(this.requireUserId(req), scheduleId);
  }

  @Get('executions/:executionId/download')
  async downloadExecution(
    @Req() req: Request,
    @Param('executionId') executionId: string,
    @Res() res: Response,
  ) {
    const normalized = String(executionId ?? '').trim();
    if (!normalized) throw new BadRequestException('executionId is required');

    const file = await this.trackScheduleService.downloadExecution(
      this.requireUserId(req),
      normalized,
    );

    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  private requireUserId(req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }
}
