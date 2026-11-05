import { useDailyTimesheet } from '../hooks/useDailyTimesheet';
import { useSearchParams } from 'react-router-dom';
import QuickTaskEntry from '../components/tasks/QuickTaskEntry';
import TaskRow from '../components/tasks/TaskRow';
import { formatDuration } from '../utils/duration';
import { formatWorkdayDate, shiftWorkdayDate, validateWorkdayDate } from '../utils/workday';

function DailyTimesheet() {
  const [params] = useSearchParams();
  let requestedDate = params.get('date');
  let dateError = '';
  if (requestedDate !== null) {
    try { validateWorkdayDate(requestedDate); }
    catch {
      dateError = 'The linked workday date is invalid. Showing the current workday instead.';
      requestedDate = null;
    }
  }
  const daily = useDailyTimesheet(requestedDate);
  const date = daily.selectedDate;
  const timeZone = daily.preferences?.timeZone;
  const pending = daily.tasks.filter((task) => !task.isCompleted);
  const completed = daily.tasks.filter((task) => task.isCompleted);
  const total = daily.tasks.reduce((minutes, task) => minutes + task.durationMinutes, 0);

  return (
    <section className="daily-page" aria-labelledby="daily-title">
      {dateError && <p className="alert alert-warning" role="alert">{dateError}</p>}
      <div className="daily-heading">
        <div>
          <p className="eyebrow mb-1">Your workday</p>
          <h1 id="daily-title" className="h2 mb-1">Daily Timesheet</h1>
          {daily.selectedDate && <p className="text-secondary mb-0">{formatWorkdayDate(daily.selectedDate)}</p>}
        </div>
        <div className="daily-total" aria-label="Daily total">
          <span className="small text-secondary">Daily total</span>
          <strong>{formatDuration(total)}</strong>
          <span className="small text-secondary">{daily.tasks.length} {daily.tasks.length === 1 ? 'task' : 'tasks'}</span>
        </div>
      </div>
      {daily.preferences && (
        <p className="small text-secondary mb-3">
          {daily.preferences.timeZone} · Workday starts {daily.preferences.workdayStart}, ends {daily.preferences.workdayEnd}.
          {' '}After midnight, tasks belong to the previous workday until the next start.
        </p>
      )}
      {date && (
        <nav className="day-navigation mb-3" aria-label="Workday navigation">
          <button type="button" className="btn btn-outline-secondary" disabled={daily.busy} onClick={() => daily.selectDate(shiftWorkdayDate(date, -1))}>Previous day</button>
          <label htmlFor="workday-date" className="visually-hidden">Selected workday</label>
          <input
            id="workday-date" type="date" className="form-control" value={date}
            disabled={daily.busy} onChange={(event) => { if (event.target.value) daily.selectDate(event.target.value); }}
          />
          <button type="button" className="btn btn-outline-secondary" disabled={daily.busy} onClick={() => daily.selectDate(shiftWorkdayDate(date, 1))}>Next day</button>
          <button type="button" className="btn btn-outline-primary" disabled={daily.busy} onClick={() => daily.selectDate(null)}>Current workday</button>
        </nav>
      )}
      {daily.error && (
        <div className="alert alert-danger" role="alert">
          <p className="mb-2">{daily.error}</p>
          <button type="button" className="btn btn-outline-danger btn-sm" disabled={daily.busy} onClick={daily.refresh}>Retry loading</button>
        </div>
      )}
      {daily.projectError && (
        <p className="alert alert-warning" role="alert">Projects could not be loaded: {daily.projectError}. You can still add tasks without a project.</p>
      )}
      {daily.notice && <p className="alert alert-success py-2" role="status">{daily.notice}</p>}
      {daily.loading && <p role="status">Loading your workday...</p>}
      {daily.selectedDate && daily.userId && (
        <QuickTaskEntry
          userId={daily.userId} projects={daily.projects}
          disabled={!daily.ready || daily.busy} onCreate={daily.addTask}
        />
      )}
      {daily.ready && timeZone && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="small text-secondary">Saved tasks load when you open a workday.</span>
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={daily.busy} onClick={daily.refresh}>Refresh tasks</button>
          </div>
          {daily.tasks.length === 0 ? (
            <div className="daily-empty">
              <i className="bi bi-list-check fs-1" aria-hidden="true" />
              <h2 className="h5 mt-2">A fresh workday</h2>
              <p className="text-secondary mb-0">No tasks recorded for this workday. Type your first task above and press Enter.</p>
            </div>
          ) : (
            [pending, completed].map((group, groupIndex) => (
              <section key={groupIndex} className="mb-4" aria-labelledby={`group-title-${groupIndex}`}>
                <h2 id={`group-title-${groupIndex}`} className="h5">{groupIndex === 0 ? 'Pending' : 'Completed'} ({group.length})</h2>
                {group.length === 0 ? <p className="text-secondary small">No {groupIndex === 0 ? 'pending' : 'completed'} tasks.</p> : (
                  <ul className="task-list">
                    {group.map((task, index) => (
                      <TaskRow
                        key={task.id} task={task} projects={daily.projects} timeZone={timeZone}
                        busy={daily.busy} canMoveUp={index > 0} canMoveDown={index < group.length - 1}
                        onSave={(input) => daily.updateTask(task, input)}
                        onToggle={() => daily.toggleTask(task)} onDelete={() => daily.removeTask(task)}
                        onMove={(direction) => daily.moveTask(task, direction)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </>
      )}
    </section>
  );
}

export default DailyTimesheet;
