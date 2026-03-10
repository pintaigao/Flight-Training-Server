const CHICAGO_TZ = 'America/Chicago';

function getChicagoHourMinute(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  return { hour, minute };
}

export function isChicagoMorning(isoString: string, startHHMM = '06:00', endHHMM = '12:00'): boolean {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return false;

  const [startH, startM] = startHHMM.split(':').map((x) => Number(x));
  const [endH, endM] = endHHMM.split(':').map((x) => Number(x));
  if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) return false;

  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  const { hour, minute } = getChicagoHourMinute(date);
  const local = hour * 60 + minute;
  return local >= start && local < end;
}
