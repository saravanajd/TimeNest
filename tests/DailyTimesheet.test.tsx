// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DailyTimesheetPage from '../src/pages/DailyTimesheet';
import type { Task } from '../src/models/task';
import { DEFAULT_USER_PREFERENCES } from '../src/models/preferences';

const mocks = vi.hoisted(() => ({
  user: { uid: 'test-user' },
  getTasks: vi.fn(), createTask: vi.fn(), editTask: vi.fn(), deleteTask: vi.fn(),
  reorderTasks: vi.fn(), setTaskCompleted: vi.fn(), newTaskId: vi.fn(),
  getProjects: vi.fn(), getPreferences: vi.fn(),
}));
function DailyTimesheet() {
  return <MemoryRouter><DailyTimesheetPage /></MemoryRouter>;
}
vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../src/services/taskService', () => mocks);
vi.mock('../src/services/projectService', () => ({ getProjects: mocks.getProjects }));
vi.mock('../src/services/settingsService', () => ({ getPreferences: mocks.getPreferences }));

function task(id: string, title: string, order = 0): Task {
  return {
    id, title, taskDate: '2026-11-05', sortOrder: order, projectId: null, improvedTitle: null,
    isCompleted: false, startTime: null, endTime: null, durationMinutes: 0,
    createdAt: new Date('2026-11-05T22:00Z'), updatedAt: new Date('2026-11-05T22:00Z'),
  };
}

beforeEach(() => {
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-06T06:30Z'));
  mocks.getPreferences.mockResolvedValue(DEFAULT_USER_PREFERENCES);
  mocks.getProjects.mockResolvedValue([]);
  mocks.getTasks.mockResolvedValue([]);
  mocks.newTaskId.mockReturnValue('new-task-id');
  mocks.createTask.mockImplementation(async (_uid, id, date, input, order) => ({
    ...task(id, input.title.trim(), order), ...input, taskDate: date,
  }));
  mocks.editTask.mockResolvedValue(undefined);
  mocks.deleteTask.mockResolvedValue(undefined);
  mocks.reorderTasks.mockResolvedValue(undefined);
  mocks.setTaskCompleted.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function openDaily() {
  const rendered = render(<DailyTimesheet />);
  await act(async () => {});
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add task' })).toBeEnabled());
  return rendered;
}

describe('daily task entry and day navigation', () => {
  it('opens a linked workday and permits creating tasks and navigating from that day', async () => {
    render(<MemoryRouter initialEntries={['/?date=2026-10-31']}><DailyTimesheetPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add task' })).toBeEnabled());
    expect(mocks.getTasks).toHaveBeenCalledWith('test-user', '2026-10-31');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Task description'), 'Linked day task{Enter}');
    await screen.findByText('Linked day task');
    expect(mocks.createTask.mock.calls[0][2]).toBe('2026-10-31');
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(mocks.getTasks).toHaveBeenLastCalledWith('test-user', '2026-11-01'));
    await user.click(screen.getByRole('button', { name: 'Current workday' }));
    await waitFor(() => expect(mocks.getTasks).toHaveBeenLastCalledWith('test-user', '2026-11-05'));
  });

  it('reports invalid linked dates and opens the current workday instead', async () => {
    render(<MemoryRouter initialEntries={['/?date=2026-02-30']}><DailyTimesheetPage /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('linked workday date is invalid');
    await waitFor(() => expect(mocks.getTasks).toHaveBeenCalledWith('test-user', '2026-11-05'));
  });

  it('opens the previous workday after midnight and saves with Enter, clears and refocuses', async () => {
    await openDaily();
    expect(mocks.getTasks).toHaveBeenCalledWith('test-user', '2026-11-05');
    const user = userEvent.setup();
    const input = screen.getByLabelText('Task description');
    await user.type(input, 'Review invoices{Enter}');
    await screen.findByText('Review invoices');
    expect(mocks.createTask).toHaveBeenCalledWith('test-user', 'new-task-id', '2026-11-05', {
      title: 'Review invoices', projectId: null, startTime: null, endTime: null,
    }, 0);
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('prevents duplicate submissions while saving', async () => {
    let resolveSave!: (value: Task) => void;
    mocks.createTask.mockReturnValue(new Promise<Task>((resolve) => { resolveSave = resolve; }));
    await openDaily();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Task description'), 'One task{Enter}{Enter}');
    expect(mocks.createTask).toHaveBeenCalledTimes(1);
    await act(async () => { resolveSave(task('new-task-id', 'One task')); });
    expect(screen.getByLabelText('Task description')).toHaveValue('');
  });

  it('keeps failed input and reuses the same ID on an explicit retry', async () => {
    mocks.createTask.mockRejectedValueOnce(new Error('Network unavailable'));
    await openDaily();
    const user = userEvent.setup();
    const input = screen.getByLabelText('Task description');
    await user.type(input, 'Keep my task{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    expect(input).toHaveValue('Keep my task');
    await user.keyboard('{Enter}');
    await screen.findByText('Keep my task');
    expect(mocks.newTaskId).toHaveBeenCalledTimes(1);
  });

  it('rejects blank descriptions and does not depend on project availability', async () => {
    mocks.getProjects.mockRejectedValue(new Error('Projects permission denied'));
    await openDaily();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Task description'), '   {Enter}');
    expect(await screen.findByText('Enter a task description.')).toBeVisible();
    expect(mocks.createTask).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add task' })).toBeEnabled();
    expect(screen.getByText(/You can still add tasks without a project/)).toBeVisible();
  });

  it('saves optional projects against an explicitly selected historical workday', async () => {
    mocks.getProjects.mockResolvedValue([
      { id: 'active', name: 'Active project', isActive: true },
      { id: 'inactive', name: 'Archived project', isActive: false },
    ]);
    await openDaily();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add task' })).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('Project (optional)'), 'active');
    expect(screen.queryByRole('option', { name: 'Archived project' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Task description'), 'Historical task{Enter}');
    await screen.findByText('Historical task');
    expect(mocks.createTask).toHaveBeenCalledWith('test-user', 'new-task-id', '2026-11-04', {
      title: 'Historical task', projectId: 'active', startTime: null, endTime: null,
    }, 0);
  });

  it('shows load errors rather than pretending the workday is empty', async () => {
    mocks.getTasks.mockRejectedValueOnce(new Error('Tasks permission denied'));
    render(<DailyTimesheet />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Tasks permission denied');
    expect(screen.queryByText('A fresh workday')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry loading' }));
    await screen.findByText('A fresh workday');
  });

  it('navigates backwards, forwards, and returns to the current workday', async () => {
    await openDaily();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    await waitFor(() => expect(mocks.getTasks).toHaveBeenLastCalledWith('test-user', '2026-11-04'));
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(mocks.getTasks).toHaveBeenLastCalledWith('test-user', '2026-11-05'));
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(mocks.getTasks).toHaveBeenLastCalledWith('test-user', '2026-11-06'));
    await user.click(screen.getByRole('button', { name: 'Current workday' }));
    await waitFor(() => expect(mocks.getTasks).toHaveBeenLastCalledWith('test-user', '2026-11-05'));
  });

  it('ignores a late response from a previously selected workday', async () => {
    let resolveOld!: (value: Task[]) => void;
    mocks.getTasks.mockImplementation((_uid, date) => date === '2026-11-04'
      ? new Promise<Task[]>((resolve) => { resolveOld = resolve; }) : Promise.resolve([]));
    await openDaily();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    await user.click(screen.getByRole('button', { name: 'Current workday' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add task' })).toBeEnabled());
    await act(async () => { resolveOld([task('old', 'Wrong day task')]); });
    expect(screen.queryByText('Wrong day task')).not.toBeInTheDocument();
  });

  it('rolls over at 4 PM while retaining unsaved text, but leaves a historical day pinned', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T21:59:59Z'));
    render(<DailyTimesheet />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mocks.getTasks).toHaveBeenCalledWith('test-user', '2026-11-04');
    fireEvent.change(screen.getByLabelText('Task description'), { target: { value: 'Unsaved draft' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(mocks.getTasks).toHaveBeenLastCalledWith('test-user', '2026-11-05');
    expect(screen.getByLabelText('Task description')).toHaveValue('Unsaved draft');
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    await act(async () => {});
    vi.setSystemTime(new Date('2026-11-06T22:00:00Z'));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(mocks.getTasks).toHaveBeenLastCalledWith('test-user', '2026-11-04');
  });
});

describe('task lifecycle', () => {
  it('completes and reopens without deleting, and keeps completed time in daily totals', async () => {
    mocks.getTasks.mockResolvedValue([{ ...task('one', 'First task'), durationMinutes: 90 }]);
    await openDaily();
    const user = userEvent.setup();
    expect(within(screen.getByLabelText('Daily total')).getByText('1h 30m')).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: 'Complete First task' }));
    expect(mocks.setTaskCompleted).toHaveBeenCalledWith('test-user', 'one', true);
    expect(await screen.findByRole('checkbox', { name: 'Reopen First task' })).toBeChecked();
    expect(mocks.deleteTask).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox', { name: 'Reopen First task' }));
    expect(mocks.setTaskCompleted).toHaveBeenLastCalledWith('test-user', 'one', false);
  });

  it('edits descriptions and overnight times inline, validates ranges, and requires deletion confirmation', async () => {
    mocks.getTasks.mockResolvedValue([task('one', 'First task')]);
    await openDaily();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit First task' }));
    const form = screen.getByRole('form', { name: 'Edit First task' });
    const title = within(form).getByLabelText('Task description');
    await user.clear(title);
    await user.type(title, 'Updated task');
    const start = within(form).getByLabelText('Start time');
    const end = within(form).getByLabelText('End time');
    fireEvent.change(start, { target: { value: '2026-11-05T23:30' } });
    fireEvent.change(end, { target: { value: '2026-11-05T01:00' } });
    await user.click(within(form).getByRole('button', { name: 'Save task' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('End time must not be before');
    expect(mocks.editTask).not.toHaveBeenCalled();
    fireEvent.change(end, { target: { value: '2026-11-06T01:00' } });
    await user.click(within(form).getByRole('button', { name: 'Save task' }));
    await screen.findByText('Updated task');
    expect(mocks.editTask).toHaveBeenCalledWith('test-user', 'one', {
      title: 'Updated task', projectId: null,
      startTime: new Date('2026-11-06T05:30Z'), endTime: new Date('2026-11-06T07:00Z'),
    });
    expect(within(screen.getByLabelText('Daily total')).getByText('1h 30m')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete Updated task' }));
    expect(mocks.deleteTask).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await screen.findByText('A fresh workday');
    expect(mocks.deleteTask).toHaveBeenCalledWith('test-user', 'one');
  });

  it('persists keyboard-accessible reordering', async () => {
    mocks.getTasks.mockResolvedValue([task('one', 'First task'), task('two', 'Second task', 1)]);
    await openDaily();
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Move First task up' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move Second task up' }));
    expect(mocks.reorderTasks).toHaveBeenCalledWith('test-user', [
      expect.objectContaining({ id: 'two' }), expect.objectContaining({ id: 'one' }),
    ]);
    expect(screen.getAllByRole('button', { name: /^Edit / })[0]).toHaveAccessibleName('Edit Second task');
  });

  it('keeps inline edits and existing status when saving fails', async () => {
    mocks.getTasks.mockResolvedValue([task('one', 'First task')]);
    mocks.editTask.mockRejectedValueOnce(new Error('Save unavailable'));
    await openDaily();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit First task' }));
    const form = screen.getByRole('form', { name: 'Edit First task' });
    await user.clear(within(form).getByLabelText('Task description'));
    await user.type(within(form).getByLabelText('Task description'), 'Keep this edit');
    await user.click(within(form).getByRole('button', { name: 'Save task' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save unavailable');
    expect(within(form).getByLabelText('Task description')).toHaveValue('Keep this edit');
    await user.click(within(form).getByRole('button', { name: 'Cancel editing' }));
    expect(screen.getByText('First task', { exact: true })).toBeVisible();
  });
});
