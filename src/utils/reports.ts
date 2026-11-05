import type { Project } from '../models/project';
import type { Task } from '../models/task';
import { shiftWorkdayDate, validateWorkdayDate } from './workday';

export type ReportPeriod = 'weekly' | 'monthly';
export type DateRange = { start: string; end: string };
export type ProjectFilter = { kind: 'all' } | { kind: 'unassigned' } | { kind: 'project'; id: string };
export const ALL_PROJECTS: ProjectFilter = { kind: 'all' };

export function getReportRange(date: string, period: ReportPeriod): DateRange {
  validateWorkdayDate(date);
  if (period === 'weekly') {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    const start = shiftWorkdayDate(date, -((day + 6) % 7));
    const range = { start, end: shiftWorkdayDate(start, 6) };
    validateDateRange(range);
    return range;
  }
  const start = `${date.slice(0, 7)}-01`;
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1, 0);
  return { start, end: next.toISOString().slice(0, 10) };
}

export function shiftReportDate(date: string, period: ReportPeriod, direction: -1 | 1): string {
  validateWorkdayDate(date);
  if (period === 'weekly') return shiftWorkdayDate(date, direction * 7);
  const next = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + direction);
  return next.toISOString().slice(0, 10);
}

export function validateDateRange(range: DateRange) {
  validateWorkdayDate(range.start);
  validateWorkdayDate(range.end);
  if (range.start > range.end) throw new Error('The start workday must not be after the end workday.');
}

export function filterReportRange(period: DateRange, start: string, end: string): DateRange {
  const filtered = { start: start || period.start, end: end || period.end };
  validateDateRange(filtered);
  if (filtered.start < period.start || filtered.end > period.end) {
    throw new Error('Date filters must stay inside the selected reporting period.');
  }
  return filtered;
}

export function getProjectLabel(projectId: string | null, projects: Project[]): string {
  if (projectId === null) return 'No project';
  const project = projects.find((item) => item.id === projectId);
  return project ? `${project.name}${project.isActive ? '' : ' (inactive)'}` : `Unavailable project (${projectId})`;
}

export function buildReport(tasks: Task[], range: DateRange, projectFilter: ProjectFilter = ALL_PROJECTS) {
  validateDateRange(range);
  const selected = tasks.filter((task) => task.taskDate >= range.start && task.taskDate <= range.end &&
    (projectFilter.kind === 'all' ||
      (projectFilter.kind === 'unassigned' ? task.projectId === null : task.projectId === projectFilter.id)));
  const byDay = new Map<string, Task[]>();
  const byProject = new Map<string | null, { projectId: string | null; minutes: number; taskCount: number }>();
  let totalMinutes = 0;
  let completedCount = 0;
  for (const task of selected) {
    const day = byDay.get(task.taskDate) ?? [];
    day.push(task);
    byDay.set(task.taskDate, day);
    const project = byProject.get(task.projectId) ?? { projectId: task.projectId, minutes: 0, taskCount: 0 };
    project.minutes += task.durationMinutes;
    project.taskCount += 1;
    byProject.set(task.projectId, project);
    totalMinutes += task.durationMinutes;
    completedCount += Number(task.isCompleted);
  }
  const days = [];
  for (let date = range.start; date <= range.end; date = shiftWorkdayDate(date, 1)) {
    const dayTasks = (byDay.get(date) ?? []).slice().sort((a, b) =>
      a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    days.push({ date, tasks: dayTasks, minutes: dayTasks.reduce((sum, task) => sum + task.durationMinutes, 0) });
    if (date === range.end) break;
  }
  return {
    days, projects: [...byProject.values()], totalMinutes, taskCount: selected.length,
    completedCount, pendingCount: selected.length - completedCount,
    workdayCount: byDay.size,
  };
}
