const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Current date and time in Argentina. */
export function nowInArgentina(date = new Date()): {
  date: string;
  time: string;
} {
  // "sv-SE" formats as "2026-10-22 09:15:00"
  const local = date
    .toLocaleString('sv-SE', { timeZone: TIME_ZONE })
    .replace(' ', 'T')
    .slice(0, 16);
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** True if date (YYYY-MM-DD) and time (HH:mm) exist in the calendar. */
export function isValidDateAndTime(date: string, time: string): boolean {
  const mDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const mTime = /^(\d{2}):(\d{2})$/.exec(time);
  if (!mDate || !mTime) return false;
  const [year, month, day] = mDate.slice(1).map(Number);
  const [hour, minute] = mTime.slice(1).map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day &&
    hour <= 23 &&
    minute <= 59
  );
}

/** True if (date, time) is strictly after (referenceDate, referenceTime). */
export function isStrictlyAfter(
  date: string,
  time: string,
  referenceDate: string,
  referenceTime: string,
): boolean {
  return `${date}T${time}` > `${referenceDate}T${referenceTime}`;
}
