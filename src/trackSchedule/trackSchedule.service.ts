import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateTrackScheduleDto } from './dto/trackSchedule.dto';

type HeaderMap = Record<string, string>;

@Injectable()
export class TrackScheduleService {
  private readonly baseUrl =
    process.env.ADSB_TRACKER_BASE_URL ?? 'http://localhost:5053';
  private readonly serviceToken =
    process.env.ADSB_TRACKER_SERVICE_TOKEN ?? '';

  async create(userId: string, dto: CreateTrackScheduleDto) {
    return this.request('/adsb/flights/track-schedules', {
      method: 'POST',
      userId,
      body: dto,
    });
  }

  async list(userId: string) {
    return this.request('/adsb/flights/track-schedules', {
      method: 'GET',
      userId,
    });
  }

  async getById(userId: string, id: string) {
    return this.request(`/adsb/flights/track-schedules/${encodeURIComponent(id)}`, {
      method: 'GET',
      userId,
    });
  }

  async cancel(userId: string, id: string) {
    return this.request(`/adsb/flights/track-schedules/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      userId,
    });
  }

  async archive(userId: string, id: string) {
    return this.request(`/adsb/flights/track-schedules/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      userId,
    });
  }

  async listExecutions(userId: string, id: string) {
    return this.request(`/adsb/flights/track-schedules/${encodeURIComponent(id)}/executions`, {
      method: 'GET',
      userId,
    });
  }

  async downloadExecution(userId: string, executionId: string) {
    const response = await fetch(
      `${this.baseUrl}/adsb/flights/track-schedules/executions/${encodeURIComponent(executionId)}/download`,
      {
        method: 'GET',
        headers: this.headers(userId),
      },
    );

    if (!response.ok) {
      throw await this.toHttpException(response);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType:
        response.headers.get('content-type') ??
        'application/vnd.google-earth.kml+xml',
      filename: this.readFilename(response.headers.get('content-disposition')),
    };
  }

  private async request(
    path: string,
    input: {
      method: 'GET' | 'POST';
      userId: string;
      body?: unknown;
    },
  ) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: input.method,
      headers: this.headers(input.userId, input.body != null),
      body: input.body == null ? undefined : JSON.stringify(input.body),
    });

    if (!response.ok) {
      throw await this.toHttpException(response);
    }

    if (response.status === 204) {
      return { ok: true };
    }

    return response.json();
  }

  private headers(userId: string, withJson = false): HeaderMap {
    const headers: HeaderMap = {
      'X-User-Id': userId,
    };

    if (withJson) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.serviceToken) {
      headers['X-Service-Token'] = this.serviceToken;
    }

    return headers;
  }

  private async toHttpException(response: Response) {
    const raw = await response.text();
    let body: unknown = raw;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw;
    }

    if (response.status >= 400 && response.status < 600) {
      return new HttpException(body ?? 'Tracker service error', response.status);
    }

    return new InternalServerErrorException(body ?? 'Tracker service error');
  }

  private readFilename(contentDisposition: string | null) {
    if (!contentDisposition) return 'track-log.kml';
    const match = /filename="?([^"]+)"?/i.exec(contentDisposition);
    return match?.[1] ?? 'track-log.kml';
  }
}
