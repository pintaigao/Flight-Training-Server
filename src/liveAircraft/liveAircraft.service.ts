import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class LiveAircraftService {
  private readonly baseUrl =
    process.env.ADSB_TRACKER_BASE_URL ?? 'http://localhost:5053';

  async getSnapshot() {
    const response = await fetch(
      `${this.baseUrl}/api/v1/adsb/flights/live-aircraft`,
      { method: 'GET' },
    );

    if (!response.ok) {
      throw await this.toHttpException(response);
    }

    return response.json();
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
}
