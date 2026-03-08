export class UpsertFlightDto {
  dateISO: string;
  startTimeISO?: string | null;
  endTimeISO?: string | null;
  aircraftTail: string;
  from: string;
  to: string;
  durationMin: number;
  description?: string | null;
  tags: string[];
  comments: string;
}

export class PatchFlightDescriptionDto {
  description: string;
}
