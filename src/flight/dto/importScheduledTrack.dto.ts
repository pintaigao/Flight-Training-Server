export class ImportScheduledTrackDto {
  userId: string;
  scheduleId: number;
  executionId: number;
  displayName: string;
  targetType: string;
  targetValue: string;
  rawKml: string;
  rawFilename?: string | null;
}
