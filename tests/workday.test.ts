import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_PREFERENCES } from '../src/models/preferences';
import { getWorkdayDate, shiftWorkdayDate, validateWorkdayDate } from '../src/utils/workday';
import { fromLocalDateTime, toLocalDateTime } from '../src/utils/dateTime';
import { calculateDurationMinutes, formatDuration } from '../src/utils/duration';

describe('Chicago workday rollover, independently of the browser time zone', () => {
  it.each([
    ['2026-11-05T21:59:59Z', '2026-11-04'],
    ['2026-11-05T22:00:00Z', '2026-11-05'],
    ['2026-11-06T06:30:00Z', '2026-11-05'],
    ['2026-11-06T19:00:00Z', '2026-11-05'],
    ['2026-07-05T20:59:59Z', '2026-07-04'],
    ['2026-07-05T21:00:00Z', '2026-07-05'],
    ['2026-03-08T07:59:00Z', '2026-03-07'],
    ['2026-03-08T08:00:00Z', '2026-03-07'],
    ['2026-03-08T20:59:59Z', '2026-03-07'],
    ['2026-03-08T21:00:00Z', '2026-03-08'],
    ['2026-11-01T06:30:00Z', '2026-10-31'],
    ['2026-11-01T07:30:00Z', '2026-10-31'],
    ['2026-11-01T21:59:59Z', '2026-10-31'],
    ['2026-11-01T22:00:00Z', '2026-11-01'],
    ['2027-01-01T06:30:00Z', '2026-12-31'],
  ])('%s belongs to %s', (instant, expected) => {
    expect(getWorkdayDate(new Date(instant))).toBe(expected);
  });

  it('uses saved settings without changing the defaults', () => {
    expect(getWorkdayDate(new Date('2026-11-06T13:30:00Z'), {
      ...DEFAULT_USER_PREFERENCES, timeZone: 'Asia/Kolkata', workdayStart: '09:00',
    })).toBe('2026-11-06');
    expect(DEFAULT_USER_PREFERENCES.timeZone).toBe('America/Chicago');
  });

  it('rejects invalid dates and settings', () => {
    expect(() => getWorkdayDate(new Date('invalid'))).toThrow();
    expect(() => getWorkdayDate(new Date(), { ...DEFAULT_USER_PREFERENCES, timeZone: 'Not/AZone' })).toThrow();
    expect(() => getWorkdayDate(new Date(), { ...DEFAULT_USER_PREFERENCES, workdayStart: '25:00' })).toThrow();
    expect(() => validateWorkdayDate('2026-02-30')).toThrow();
    expect(() => validateWorkdayDate('invalid')).toThrow();
  });

  it('navigates calendar days across leap days and month/year boundaries', () => {
    expect(shiftWorkdayDate('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftWorkdayDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftWorkdayDate('2026-03-08', 1)).toBe('2026-03-09');
  });
});

describe('local times and UTC duration', () => {
  it('handles an overnight task without subtracting local clock strings', () => {
    const start = fromLocalDateTime('2026-11-05T23:30', 'America/Chicago');
    const end = fromLocalDateTime('2026-11-06T01:00', 'America/Chicago');
    expect(start?.toISOString()).toBe('2026-11-06T05:30:00.000Z');
    expect(calculateDurationMinutes(start, end)).toBe(90);
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('uses elapsed time across spring and fall DST changes', () => {
    expect(calculateDurationMinutes(
      fromLocalDateTime('2026-03-08T01:30', 'America/Chicago'),
      fromLocalDateTime('2026-03-08T03:30', 'America/Chicago'),
    )).toBe(60);
    expect(calculateDurationMinutes(
      fromLocalDateTime('2026-11-01T00:30', 'America/Chicago'),
      fromLocalDateTime('2026-11-01T02:30', 'America/Chicago'),
    )).toBe(180);
  });

  it('rejects nonexistent and ambiguous local times instead of guessing an offset', () => {
    expect(() => fromLocalDateTime('2026-03-08T02:30', 'America/Chicago')).toThrow(/does not exist/);
    expect(() => fromLocalDateTime('2026-11-01T01:30', 'America/Chicago')).toThrow(/occurs twice/);
  });

  it('allows missing times, but not an end without a start or backwards times', () => {
    expect(fromLocalDateTime('', 'America/Chicago')).toBeNull();
    expect(calculateDurationMinutes(null, null)).toBe(0);
    expect(calculateDurationMinutes(new Date('2026-11-05T22:00Z'), null)).toBe(0);
    expect(() => calculateDurationMinutes(null, new Date())).toThrow(/start time/);
    expect(() => calculateDurationMinutes(new Date('2026-11-05T23:00Z'), new Date('2026-11-05T22:00Z'))).toThrow(/before/);
    expect(() => calculateDurationMinutes(new Date('invalid'), null)).toThrow();
    expect(() => fromLocalDateTime('2026-02-30T12:00', 'America/Chicago')).toThrow();
    expect(toLocalDateTime(null, 'America/Chicago')).toBe('');
  });

  it('rounds elapsed seconds to the nearest whole minute', () => {
    const start = new Date('2026-11-05T22:00:00Z');
    expect(calculateDurationMinutes(start, new Date('2026-11-05T22:00:29Z'))).toBe(0);
    expect(calculateDurationMinutes(start, new Date('2026-11-05T22:00:30Z'))).toBe(1);
    expect(calculateDurationMinutes(start, new Date('2026-11-05T22:01:30Z'))).toBe(2);
  });
});
