// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WeeklyView from '../src/pages/WeeklyView';
import MonthlyReport from '../src/pages/MonthlyReport';
import DailyTimesheet from '../src/pages/DailyTimesheet';
import type { Task } from '../src/models/task';
import { DEFAULT_USER_PREFERENCES } from '../src/models/preferences';

const mocks = vi.hoisted(() => ({
  user: { uid: 'report-user' }, getTasksInRange: vi.fn(), getTasks: vi.fn(),
  getPreferences: vi.fn(), getProjects: vi.fn(),
}));
vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../src/services/taskService', () => mocks);
vi.mock('../src/services/settingsService', () => ({ getPreferences: mocks.getPreferences }));
vi.mock('../src/services/projectService', () => ({ getProjects: mocks.getProjects }));

function task(id: string, date: string, minutes: number, projectId: string | null, isCompleted = false): Task {
  return {
    id, taskDate: date, title: id, durationMinutes: minutes, projectId, isCompleted,
    improvedTitle: null, startTime: null, endTime: null, sortOrder: 0,
    createdAt: new Date('2026-11-01T22:00Z'), updatedAt: new Date('2026-11-01T22:00Z'),
  };
}
const fixtures = [
  task('Completed work', '2026-11-02', 90, 'active', true),
  task('Pending work', '2026-11-03', 30, null),
  task('Legacy work', '2026-11-04', 0, 'old'),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-06T06:30Z'));
  mocks.getPreferences.mockResolvedValue(DEFAULT_USER_PREFERENCES);
  mocks.getProjects.mockResolvedValue([
    { id: 'active', name: 'Current project', isActive: true },
    { id: 'inactive', name: 'Archived project', isActive: false },
  ]);
  mocks.getTasksInRange.mockImplementation(async (_uid, start, end) =>
    fixtures.filter((item) => item.taskDate >= start && item.taskDate <= end));
  mocks.getTasks.mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openReport(period: 'weekly' | 'monthly' = 'weekly') {
  render(<MemoryRouter initialEntries={[`/${period}`]}>
    <Routes>
      <Route path="/weekly" element={<WeeklyView />} />
      <Route path="/monthly" element={<MonthlyReport />} />
      <Route path="/" element={<DailyTimesheet />} />
    </Routes>
  </MemoryRouter>);
  await act(async () => {});
  await screen.findByLabelText('Report totals');
}

describe('weekly and monthly report UI', () => {
  it('loads Monday-Sunday with both statuses, totals and empty-day links', async () => {
    await openReport();
    expect(mocks.getTasksInRange).toHaveBeenCalledWith('report-user', '2026-11-02', '2026-11-08');
    expect(within(screen.getByLabelText('Report totals')).getByText('2h 0m')).toBeVisible();
    expect(screen.getByText('Completed work')).toBeVisible();
    expect(screen.getByText('Pending work')).toBeVisible();
    expect(screen.getAllByText('No tasks recorded for this workday.')).toHaveLength(4);
    expect(screen.getByLabelText('Total for 2026-11-02')).toHaveTextContent('1h 30m');
    await userEvent.setup().click(screen.getByRole('link', { name: 'Monday, November 2, 2026' }));
    await waitFor(() => expect(mocks.getTasks).toHaveBeenCalledWith('report-user', '2026-11-02'));
    expect(screen.getByRole('heading', { name: 'Daily Timesheet' })).toBeVisible();
  });

  it('navigates previous, next, current weeks and reloads data', async () => {
    await openReport();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    await waitFor(() => expect(mocks.getTasksInRange).toHaveBeenLastCalledWith('report-user', '2026-10-26', '2026-11-01'));
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    await waitFor(() => expect(mocks.getTasksInRange).toHaveBeenLastCalledWith('report-user', '2026-11-02', '2026-11-08'));
    fireEvent.change(screen.getByLabelText('Workday in selected week'), { target: { value: '2026-12-31' } });
    await waitFor(() => expect(mocks.getTasksInRange).toHaveBeenLastCalledWith('report-user', '2026-12-28', '2027-01-03'));
    await user.click(screen.getByRole('button', { name: 'Current week' }));
    await screen.findByText('Completed work');
    const before = mocks.getTasksInRange.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Refresh report' }));
    await waitFor(() => expect(mocks.getTasksInRange.mock.calls.length).toBeGreaterThan(before));
  });

  it('filters projects including unassigned, inactive and deleted projects without refetching', async () => {
    await openReport('monthly');
    const user = userEvent.setup();
    const before = mocks.getTasksInRange.mock.calls.length;
    await user.selectOptions(screen.getByLabelText('Project filter'), 'unassigned');
    expect(within(screen.getByLabelText('Report totals')).getByText('0h 30m')).toBeVisible();
    expect(screen.queryByText('Completed work')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Project filter'), 'project:active');
    expect(within(screen.getByLabelText('Report totals')).getByText('1h 30m')).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Project filter'), 'project:old');
    expect(screen.getByText('Legacy work')).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Project filter'), 'project:inactive');
    expect(screen.getByText('No tasks match this period and these filters.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Completed work')).toBeVisible();
    expect(mocks.getTasksInRange.mock.calls.length).toBe(before);
  });

  it('filters dates inclusively, blocks reversed ranges, and clears dates on period changes', async () => {
    await openReport();
    fireEvent.change(screen.getByLabelText('From workday'), { target: { value: '2026-11-03' } });
    fireEvent.change(screen.getByLabelText('Through workday'), { target: { value: '2026-11-04' } });
    expect(screen.queryByText('Completed work')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Report totals')).getByText('0h 30m')).toBeVisible();
    expect(screen.getAllByRole('link')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Through workday'), { target: { value: '2026-11-02' } });
    expect(screen.getByRole('alert')).toHaveTextContent('start workday must not be after');
    expect(screen.queryByLabelText('Report totals')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next week' }));
    await screen.findByLabelText('Report totals');
    expect(screen.getByLabelText('From workday')).toHaveValue('');
    expect(screen.getByLabelText('Through workday')).toHaveValue('');
  });

  it('selects a month and year, handles leap months, and navigates year boundaries', async () => {
    await openReport('monthly');
    expect(mocks.getTasksInRange).toHaveBeenCalledWith('report-user', '2026-11-01', '2026-11-30');
    expect(screen.getAllByRole('link')).toHaveLength(30);
    fireEvent.change(screen.getByLabelText('Month and year'), { target: { value: '2028-02' } });
    await waitFor(() => expect(mocks.getTasksInRange).toHaveBeenLastCalledWith('report-user', '2028-02-01', '2028-02-29'));
    await screen.findByLabelText('Report totals');
    expect(screen.getAllByRole('link')).toHaveLength(29);
    fireEvent.change(screen.getByLabelText('Month and year'), { target: { value: '2026-12' } });
    await screen.findByLabelText('Report totals');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next month' }));
    await waitFor(() => expect(mocks.getTasksInRange).toHaveBeenLastCalledWith('report-user', '2027-01-01', '2027-01-31'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Previous month' }));
    await waitFor(() => expect(mocks.getTasksInRange).toHaveBeenLastCalledWith('report-user', '2026-12-01', '2026-12-31'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Current month' }));
    await waitFor(() => expect(mocks.getTasksInRange).toHaveBeenLastCalledWith('report-user', '2026-11-01', '2026-11-30'));
  });

  it('ignores stale responses after switching reporting periods', async () => {
    let resolveOld!: (value: Task[]) => void;
    mocks.getTasksInRange.mockImplementation((_uid, start) => start === '2026-10-26'
      ? new Promise<Task[]>((resolve) => { resolveOld = resolve; }) : Promise.resolve(fixtures));
    await openReport();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.queryByLabelText('Report totals')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Current week' }));
    await screen.findByLabelText('Report totals');
    await act(async () => { resolveOld([task('Stale task', '2026-10-26', 999, null)]); });
    expect(screen.queryByText('Stale task')).not.toBeInTheDocument();
    expect(screen.getByText('Completed work')).toBeVisible();
  });

  it('shows permission errors, not empty success, and supports retry', async () => {
    mocks.getTasksInRange.mockRejectedValueOnce(new Error('Report permission denied'));
    render(<MemoryRouter><WeeklyView /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Report permission denied');
    expect(screen.queryByLabelText('Report totals')).not.toBeInTheDocument();
    expect(screen.queryByText('No tasks match this period and these filters.')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry report' }));
    await screen.findByLabelText('Report totals');
  });

  it('does not load a report using silent default settings after preferences fail', async () => {
    mocks.getPreferences.mockRejectedValueOnce(new Error('Preferences unavailable'));
    render(<MemoryRouter><MonthlyReport /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Preferences unavailable');
    expect(mocks.getTasksInRange).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry report' }));
    await screen.findByLabelText('Report totals');
  });

  it('keeps refresh in a loading state until fresh preferences have loaded', async () => {
    await openReport();
    let resolveSettings!: (value: typeof DEFAULT_USER_PREFERENCES) => void;
    mocks.getPreferences.mockReturnValueOnce(new Promise((resolve) => { resolveSettings = resolve; }));
    const before = mocks.getTasksInRange.mock.calls.length;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh report' }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading report');
    expect(screen.queryByLabelText('Report totals')).not.toBeInTheDocument();
    expect(mocks.getTasksInRange.mock.calls.length).toBe(before);
    await act(async () => { resolveSettings(DEFAULT_USER_PREFERENCES); });
    await screen.findByLabelText('Report totals');
  });

  it('shows overnight timestamps in the configured time zone and keeps stored durations', async () => {
    mocks.getTasksInRange.mockResolvedValueOnce([{
      ...task('Overnight work', '2026-11-05', 90, null, true),
      startTime: new Date('2026-11-06T05:30Z'), endTime: new Date('2026-11-06T07:00Z'),
    }]);
    await openReport();
    expect(screen.getByLabelText('Total for 2026-11-05')).toHaveTextContent('1h 30m');
    expect(screen.getByText('Nov 5, 11:30 PM CST to Nov 6, 1:00 AM CST')).toBeVisible();
  });

  it('initializes from saved workday settings and not the browser calendar date', async () => {
    vi.setSystemTime(new Date('2026-11-02T06:30Z'));
    await openReport();
    expect(mocks.getTasksInRange).toHaveBeenCalledWith('report-user', '2026-10-26', '2026-11-01');
  });

  it('follows current workday rollover at the start of a new week', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T21:59:59Z'));
    render(<MemoryRouter><WeeklyView /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mocks.getTasksInRange).toHaveBeenLastCalledWith('report-user', '2026-10-26', '2026-11-01');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(mocks.getTasksInRange).toHaveBeenLastCalledWith('report-user', '2026-11-02', '2026-11-08');
  });
});
