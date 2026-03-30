export type CreateTrackScheduleDto = {
  displayName: string;
  targetType: 'tail' | 'hex' | 'flight';
  targetValue: string;
  watchDateUtc: string;
  startZulu: string;
  endZulu: string;
};

export type TrackScheduleExecutionDto = {
  id: number;
  scheduleId: number;
  status: string;
  matchedPointCount: number;
  startedAtUtc?: string | null;
  finishedAtUtc?: string | null;
  errorMessage?: string | null;
  downloadUrl?: string | null;
};

export type TrackScheduleDto = {
  id: number;
  displayName: string;
  targetType: string;
  targetValue: string;
  watchDateUtc: string;
  startZulu: string;
  endZulu: string;
  status: string;
  createdAtUtc: string;
  latestExecution?: TrackScheduleExecutionDto | null;
  executions?: TrackScheduleExecutionDto[];
};
