import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { validateWorkdayDate } from './workday';

export function toLocalDateTime(instant: Date | null, timeZone: string): string {
  return instant ? formatInTimeZone(instant, timeZone, "yyyy-MM-dd'T'HH:mm") : '';
}

export function fromLocalDateTime(value: string, timeZone: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error('Enter a valid date and time.');
  }
  validateWorkdayDate(value.slice(0, 10));
  const approximate = fromZonedTime(value, timeZone);
  if (!Number.isFinite(approximate.getTime())) {
    throw new Error('Enter a valid date, time, and time zone.');
  }

  // Test the offsets on both sides of a DST change rather than silently guessing.
  const offsets = new Set([-1, 0, 1].map((days) =>
    formatInTimeZone(new Date(approximate.getTime() + days * 86400000), timeZone, 'xxx'),
  ));
  const candidates = [...offsets]
    .map((offset) => new Date(`${value}:00${offset}`))
    .filter((instant) => toLocalDateTime(instant, timeZone) === value);
  if (candidates.length === 0) {
    throw new Error('That local time does not exist because of daylight saving time. Choose another time.');
  }
  if (candidates.length > 1) {
    throw new Error('That local time occurs twice because of daylight saving time. Choose an unambiguous time.');
  }
  return candidates[0];
}

export function formatTaskTime(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, 'MMM d, h:mm a zzz');
}
