import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTaskReport } from '../../hooks/useTaskReport';
import { formatWorkdayDate } from '../../utils/workday';
import { formatDuration } from '../../utils/duration';
import { formatTaskTime } from '../../utils/dateTime';
import {
  ALL_PROJECTS, buildReport, filterReportRange, getProjectLabel, shiftReportDate,
  type ProjectFilter, type ReportPeriod,
} from '../../utils/reports';

export default function ReportView({ period }: { period: ReportPeriod }) {
  const data = useTaskReport(period);
  const [projectValue, setProjectValue] = useState('all');
  const [dateFilter, setDateFilter] = useState({ periodKey: '', start: '', end: '' });
  const [inputError, setInputError] = useState('');
  const rangeKey = data.range ? `${data.range.start}:${data.range.end}` : '';
  const date = data.date;
  const timeZone = data.preferences?.timeZone;
  const filters = dateFilter.periodKey === rangeKey ? dateFilter : { start: '', end: '' };
  const weekly = period === 'weekly';
  const title = weekly ? 'Weekly View' : 'Monthly Report';
  const selectedProject: ProjectFilter = projectValue === 'all' ? ALL_PROJECTS :
    projectValue === 'unassigned' ? { kind: 'unassigned' } : { kind: 'project', id: projectValue.slice(8) };
  let filterError = '';
  let report = null;
  if (data.ready && data.range) {
    try {
      report = buildReport(data.tasks, filterReportRange(data.range, filters.start, filters.end), selectedProject);
    } catch (error) {
      filterError = error instanceof Error ? error.message : 'The report filters are invalid.';
    }
  }
  const projectIds = new Set([
    ...data.projects.map((project) => project.id),
    ...data.tasks.flatMap((task) => task.projectId === null ? [] : [task.projectId]),
  ]);
  if (selectedProject.kind === 'project') projectIds.add(selectedProject.id);
  const options = [...projectIds].sort((a, b) =>
    getProjectLabel(a, data.projects).localeCompare(getProjectLabel(b, data.projects)) || a.localeCompare(b));

  function chooseDate(value: string | null, direction?: -1 | 1) {
    setInputError('');
    try { data.selectDate(value && direction ? shiftReportDate(value, period, direction) : value); }
    catch (error) { setInputError(error instanceof Error ? error.message : 'Choose a valid report date.'); }
  }

  return (
    <section className="report-page" aria-labelledby="report-title">
      <h1 id="report-title" className="h2">{title}</h1>
      <p className="text-secondary">
        {weekly ? 'Monday to Sunday, grouped by workday.' : 'Daily detail and project totals for the selected month.'}
        {' '}Pending and completed tasks are included.
      </p>
      {date && data.range && (
        <>
          <p className="small text-secondary">
            {formatWorkdayDate(data.range.start)} to {formatWorkdayDate(data.range.end)}
            {data.preferences && ` · ${data.preferences.timeZone} · Workday rollover ${data.preferences.workdayStart}`}
          </p>
          <nav className="report-navigation mb-3" aria-label={`${weekly ? 'Week' : 'Month'} navigation`}>
            <button type="button" className="btn btn-outline-secondary" onClick={() => chooseDate(date, -1)}>
              Previous {weekly ? 'week' : 'month'}
            </button>
            <label htmlFor="report-period" className="visually-hidden">{weekly ? 'Workday in selected week' : 'Month and year'}</label>
            <input
              id="report-period" className="form-control" type={weekly ? 'date' : 'month'}
              value={weekly ? date : date.slice(0, 7)}
              onChange={(event) => {
                if (event.target.value) chooseDate(weekly ? event.target.value : `${event.target.value}-01`);
              }}
            />
            <button type="button" className="btn btn-outline-secondary" onClick={() => chooseDate(date, 1)}>
              Next {weekly ? 'week' : 'month'}
            </button>
            <button type="button" className="btn btn-outline-primary" onClick={() => chooseDate(null)}>
              Current {weekly ? 'week' : 'month'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={data.refresh}>Refresh report</button>
          </nav>
          <div className="settings-panel">
            <div className="row g-3">
              <div className="col-md-4">
                <label htmlFor="report-project" className="form-label">Project filter</label>
                <select id="report-project" className="form-select" value={projectValue} onChange={(event) => setProjectValue(event.target.value)}>
                  <option value="all">All projects</option>
                  <option value="unassigned">No project</option>
                  {options.map((id) => <option key={id} value={`project:${id}`}>{getProjectLabel(id, data.projects)}</option>)}
                </select>
              </div>
              {(['start', 'end'] as const).map((field) => (
                <div className="col-md-4" key={field}>
                  <label htmlFor={`filter-${field}`} className="form-label">{field === 'start' ? 'From workday' : 'Through workday'}</label>
                  <input
                    id={`filter-${field}`} className="form-control" type="date"
                    min={data.range?.start} max={data.range?.end} value={filters[field]}
                    onChange={(event) => setDateFilter({
                      periodKey: rangeKey, start: filters.start, end: filters.end, [field]: event.target.value,
                    })}
                  />
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-link btn-sm mt-2" onClick={() => {
              setProjectValue('all'); setDateFilter({ periodKey: rangeKey, start: '', end: '' });
            }}>Clear filters</button>
          </div>
        </>
      )}
      {(data.error || inputError || filterError) && (
        <div className="alert alert-danger" role="alert">
          {data.error || inputError || filterError}
          {data.error && <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={data.refresh}>Retry report</button>}
        </div>
      )}
      {data.loading && <p role="status">Loading report...</p>}
      {report && timeZone && (
        <>
          <div className="report-summary settings-panel" aria-label="Report totals">
            <div><span>{weekly ? 'Weekly' : 'Monthly'} total</span><strong>{formatDuration(report.totalMinutes)}</strong></div>
            <div><span>Workdays with recorded tasks</span><strong>{report.workdayCount}</strong></div>
            <div><span>Total tasks</span><strong>{report.taskCount}</strong></div>
            <div><span>Completed / pending</span><strong>{report.completedCount} / {report.pendingCount}</strong></div>
          </div>
          {report.taskCount === 0 && <p className="alert alert-info" role="status">No tasks match this period and these filters.</p>}
          <section className="settings-panel" aria-labelledby="project-totals-title">
            <h2 id="project-totals-title" className="h5">Project totals</h2>
            {report.projects.length === 0 ? <p className="text-secondary mb-0">No project totals for this selection.</p> :
              <ul className="report-project-totals">
                {report.projects.slice().sort((a, b) => getProjectLabel(a.projectId, data.projects).localeCompare(getProjectLabel(b.projectId, data.projects))).map((project) => (
                  <li key={project.projectId === null ? 'unassigned' : `project:${project.projectId}`}>
                    <span>{getProjectLabel(project.projectId, data.projects)} ({project.taskCount} tasks)</span>
                    <strong>{formatDuration(project.minutes)}</strong>
                  </li>
                ))}
              </ul>}
          </section>
          {report.days.map((day) => (
            <section key={day.date} className="settings-panel report-day" aria-labelledby={`day-${day.date}`}>
              <div className="report-day-heading">
                <h2 id={`day-${day.date}`} className="h5">
                  <Link to={`/?date=${day.date}`}>{formatWorkdayDate(day.date)}</Link>
                </h2>
                <strong aria-label={`Total for ${day.date}`}>{formatDuration(day.minutes)}</strong>
              </div>
              {day.tasks.length === 0 ? <p className="text-secondary mb-0">
                {selectedProject.kind === 'all' ? 'No tasks recorded for this workday.' : 'No tasks match the project filter for this workday.'}
              </p> :
                <ul className="report-task-list">
                  {day.tasks.map((task) => (
                    <li key={task.id}>
                      <p className="task-row__title mb-1">{task.title}</p>
                      <div className="task-meta">
                        <span>{getProjectLabel(task.projectId, data.projects)}</span>
                        <span>{task.isCompleted ? 'Completed' : 'Pending'}</span>
                        <strong>{formatDuration(task.durationMinutes)}</strong>
                      </div>
                      <p className="small text-secondary mb-0">
                        {task.startTime ? formatTaskTime(task.startTime, timeZone) : 'No start time'}
                        {' to '}
                        {task.endTime ? formatTaskTime(task.endTime, timeZone) : 'No end time'}
                      </p>
                    </li>
                  ))}
                </ul>}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
