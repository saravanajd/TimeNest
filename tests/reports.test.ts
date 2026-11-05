import { describe, expect, it } from 'vitest';
import type { Task } from '../src/models/task';
import {
  buildReport, filterReportRange, getProjectLabel, getReportRange, shiftReportDate, validateDateRange,
} from '../src/utils/reports';
import { getWorkdayDate } from '../src/utils/workday';
import { DEFAULT_USER_PREFERENCES } from '../src/models/preferences';

function task(id: string, taskDate: string, minutes: number, projectId: string | null, isCompleted = false): Task {
  return {
    id, taskDate, title: id, durationMinutes: minutes, projectId, isCompleted,
    improvedTitle: null, startTime: null, endTime: null, sortOrder: 0,
    createdAt: new Date('2026-01-01T00:00Z'), updatedAt: new Date('2026-01-01T00:00Z'),
  };
}

describe('calendar periods use workday dates, not UTC timestamp or browser date', () => {
  it.each([
    ['2026-11-01', '2026-10-26', '2026-11-01'],
    ['2026-11-02', '2026-11-02', '2026-11-08'],
    ['2027-01-01', '2026-12-28', '2027-01-03'],
    ['2026-03-08', '2026-03-02', '2026-03-08'],
  ])('Monday-Sunday containing %s', (date, start, end) => {
    expect(getReportRange(date, 'weekly')).toEqual({ start, end });
  });
  it.each([
    ['2028-02-29', '2028-02-01', '2028-02-29'],
    ['2026-02-28', '2026-02-01', '2026-02-28'],
    ['2026-12-31', '2026-12-01', '2026-12-31'],
    ['2026-04-15', '2026-04-01', '2026-04-30'],
  ])('month containing %s', (date, start, end) => {
    expect(getReportRange(date, 'monthly')).toEqual({ start, end });
  });
  it('navigates without dropping into an unintended month on the 31st', () => {
    expect(shiftReportDate('2026-01-31', 'monthly', 1)).toBe('2026-02-01');
    expect(shiftReportDate('2026-12-31', 'monthly', 1)).toBe('2027-01-01');
    expect(shiftReportDate('2027-01-01', 'monthly', -1)).toBe('2026-12-01');
    expect(shiftReportDate('2026-03-08', 'weekly', 1)).toBe('2026-03-15');
  });
  it('selects the previous month/week before workday rollover and follows configured zones', () => {
    const instant = new Date('2026-11-02T06:30Z');
    expect(getReportRange(getWorkdayDate(instant), 'weekly').start).toBe('2026-10-26');
    expect(getReportRange(getWorkdayDate(new Date('2026-11-01T06:30Z')), 'monthly').start).toBe('2026-10-01');
    expect(getReportRange(getWorkdayDate(instant, {
      ...DEFAULT_USER_PREFERENCES, timeZone: 'Asia/Kolkata', workdayStart: '09:00',
    }), 'weekly').start).toBe('2026-11-02');
  });
});

describe('shared report calculations', () => {
  const tasks = [
    task('completed', '2026-11-02', 90, 'one', true),
    task('pending', '2026-11-02', 30, 'one'),
    task('no-project', '2026-11-03', 60, null),
    task('untimed', '2026-11-04', 0, 'deleted'),
    task('out-of-period', '2026-11-09', 999, 'one'),
  ];
  const range = { start: '2026-11-02', end: '2026-11-08' };
  it('matches source records, daily totals and project totals including completed tasks', () => {
    const before = structuredClone(tasks);
    const report = buildReport(tasks, range);
    expect(report).toMatchObject({ totalMinutes: 180, taskCount: 4, completedCount: 1, pendingCount: 3, workdayCount: 3 });
    expect(report.days).toHaveLength(7);
    expect(report.days.map((day) => day.minutes)).toEqual([120, 60, 0, 0, 0, 0, 0]);
    expect(report.projects).toEqual([
      { projectId: 'one', minutes: 120, taskCount: 2 },
      { projectId: null, minutes: 60, taskCount: 1 },
      { projectId: 'deleted', minutes: 0, taskCount: 1 },
    ]);
    expect(report.projects.reduce((total, item) => total + item.minutes, 0)).toBe(report.totalMinutes);
    expect(report.days.reduce((total, day) => total + day.minutes, 0)).toBe(report.totalMinutes);
    expect(tasks).toEqual(before);
  });
  it('filters assigned and unassigned projects without dropping empty dates', () => {
    expect(buildReport(tasks, range, { kind: 'project', id: 'one' })).toMatchObject({
      totalMinutes: 120, taskCount: 2, completedCount: 1, pendingCount: 1, workdayCount: 1,
    });
    expect(buildReport(tasks, range, { kind: 'unassigned' })).toMatchObject({ totalMinutes: 60, taskCount: 1 });
    expect(buildReport(tasks, range, { kind: 'project', id: 'missing' })).toMatchObject({ totalMinutes: 0, taskCount: 0 });
  });
  it('narrows date ranges inclusively and rejects reversed or out-of-period ranges', () => {
    expect(buildReport(tasks, filterReportRange(range, '2026-11-03', '2026-11-04'))).toMatchObject({
      totalMinutes: 60, taskCount: 2, workdayCount: 2,
    });
    expect(filterReportRange(range, '', '')).toEqual(range);
    expect(() => filterReportRange(range, '2026-11-04', '2026-11-03')).toThrow(/start/);
    expect(() => filterReportRange(range, '2026-11-01', '')).toThrow(/inside/);
    expect(() => validateDateRange({ start: '2026-02-30', end: '2026-03-01' })).toThrow();
  });
  it('retains stored workday assignment for overnight and DST tasks', () => {
    const overnight = { ...task('overnight', '2026-10-31', 180, null, true),
      startTime: new Date('2026-11-01T05:30Z'), endTime: new Date('2026-11-01T08:30Z') };
    expect(buildReport([overnight], getReportRange('2026-10-31', 'monthly')).totalMinutes).toBe(180);
    expect(buildReport([overnight], getReportRange('2026-11-01', 'monthly')).taskCount).toBe(0);
  });
  it('handles leap-month empty dates and unavailable projects', () => {
    expect(buildReport([], getReportRange('2028-02-29', 'monthly')).days).toHaveLength(29);
    expect(buildReport([], getReportRange('9999-12-01', 'monthly')).days).toHaveLength(31);
    expect(() => getReportRange('9999-12-31', 'weekly')).toThrow(/date/);
    expect(getProjectLabel(null, [])).toBe('No project');
    expect(getProjectLabel('old', [])).toBe('Unavailable project (old)');
    expect(getProjectLabel('old', [{
      id: 'old', name: 'Legacy', isActive: false, description: '', createdAt: null, updatedAt: null,
    }])).toBe('Legacy (inactive)');
  });
});
