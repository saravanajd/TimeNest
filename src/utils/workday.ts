import { formatInTimeZone } from 'date-fns-tz';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '../models/preferences';

export type WorkdaySettings = Pick<UserPreferences, 'timeZone' | 'workdayStart' | 'workdayEnd'>;

export function validateWorkdaySettings(settings: WorkdaySettings) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(settings.workdayStart) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(settings.workdayEnd)) {
    throw new Error('Workday start and end must be valid times in HH:mm format.');
  }
  if (!settings.timeZone.trim()) {
    throw new Error('Enter a valid IANA time zone.');
  }
  new Intl.DateTimeFormat('en-US', { timeZone: settings.timeZone });
}

export function validateWorkdayDate(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Select a valid workday date.');
  }
}

export function shiftWorkdayDate(date: string, days: number): string {
  validateWorkdayDate(date);
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function getWorkdayDate(
  instant: Date = new Date(),
  settings: WorkdaySettings = DEFAULT_USER_PREFERENCES,
): string {
  validateWorkdaySettings(settings);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error('Cannot calculate a workday from an invalid timestamp.');
  }
  const calendarDate = formatInTimeZone(instant, settings.timeZone, 'yyyy-MM-dd');
  const localTime = formatInTimeZone(instant, settings.timeZone, 'HH:mm');
  return localTime < settings.workdayStart ? shiftWorkdayDate(calendarDate, -1) : calendarDate;
}

export function formatWorkdayDate(date: string): string {
  validateWorkdayDate(date);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`));
}
