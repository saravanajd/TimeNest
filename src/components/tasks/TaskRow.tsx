import { useState, type FormEvent } from 'react';
import type { Task, TaskInput } from '../../models/task';
import type { Project } from '../../models/project';
import { formatTaskTime, fromLocalDateTime, toLocalDateTime } from '../../utils/dateTime';
import { calculateDurationMinutes, formatDuration } from '../../utils/duration';

type TaskRowProps = {
  task: Task;
  projects: Project[];
  timeZone: string;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSave: (input: TaskInput) => Promise<boolean>;
  onToggle: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onMove: (direction: -1 | 1) => Promise<boolean>;
};

export default function TaskRow({
  task, projects, timeZone, busy, canMoveUp, canMoveDown, onSave, onToggle, onDelete, onMove,
}: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [projectId, setProjectId] = useState(task.projectId ?? '');
  const [startTime, setStartTime] = useState(toLocalDateTime(task.startTime, timeZone));
  const [endTime, setEndTime] = useState(toLocalDateTime(task.endTime, timeZone));
  const [error, setError] = useState('');
  const assignedProject = projects.find((project) => project.id === task.projectId);

  function beginEditing() {
    setTitle(task.title);
    setProjectId(task.projectId ?? '');
    setStartTime(toLocalDateTime(task.startTime, timeZone));
    setEndTime(toLocalDateTime(task.endTime, timeZone));
    setError('');
    setConfirmingDelete(false);
    setEditing(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const start = startTime === toLocalDateTime(task.startTime, timeZone)
        ? task.startTime : fromLocalDateTime(startTime, timeZone);
      const end = endTime === toLocalDateTime(task.endTime, timeZone)
        ? task.endTime : fromLocalDateTime(endTime, timeZone);
      calculateDurationMinutes(start, end);
      if (await onSave({ title, projectId: projectId || null, startTime: start, endTime: end })) {
        setEditing(false);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the task.');
    }
  }

  return (
    <li className={`task-row${task.isCompleted ? ' task-row--completed' : ''}`}>
      <div className="d-flex align-items-start gap-3">
        <input
          type="checkbox" className="form-check-input mt-1 flex-shrink-0"
          checked={task.isCompleted} disabled={busy || editing}
          aria-label={`${task.isCompleted ? 'Reopen' : 'Complete'} ${task.title}`}
          onChange={() => { void onToggle(); }}
        />
        <div className="flex-grow-1 task-content">
          {editing ? (
            <form onSubmit={save} aria-label={`Edit ${task.title}`}>
              <fieldset disabled={busy}>
                <label htmlFor={`title-${task.id}`} className="form-label">Task description</label>
                <input
                  id={`title-${task.id}`} className="form-control mb-3" value={title}
                  maxLength={1000} required autoFocus onChange={(event) => setTitle(event.target.value)}
                />
                <div className="row g-3">
                  <div className="col-12">
                    <label htmlFor={`project-${task.id}`} className="form-label">Project</label>
                    <select id={`project-${task.id}`} className="form-select" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                      <option value="">No project</option>
                      {task.projectId && !assignedProject &&
                        <option value={task.projectId}>Unavailable project (keep assignment)</option>}
                      {projects.filter((project) => project.isActive || project.id === task.projectId).map((project) =>
                        <option key={project.id} value={project.id}>{project.name}{project.isActive ? '' : ' (inactive)'}</option>,
                      )}
                    </select>
                  </div>
                  <div className="col-sm-6">
                    <label htmlFor={`start-${task.id}`} className="form-label">Start time</label>
                    <input
                      id={`start-${task.id}`} className="form-control" type="datetime-local"
                      value={startTime} onChange={(event) => setStartTime(event.target.value)}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label htmlFor={`end-${task.id}`} className="form-label">End time</label>
                    <input
                      id={`end-${task.id}`} className="form-control" type="datetime-local"
                      value={endTime} onChange={(event) => setEndTime(event.target.value)}
                    />
                  </div>
                </div>
                <p className="form-text">Times are in {timeZone}. For overnight work, set the end to the next calendar date.</p>
                {error && <p className="text-danger" role="alert">{error}</p>}
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm">Save task</button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setEditing(false)}>Cancel editing</button>
                </div>
              </fieldset>
            </form>
          ) : (
            <>
              <p className="task-row__title mb-1">{task.title}</p>
              <div className="task-meta">
                <span>{assignedProject?.name ?? (task.projectId ? 'Unavailable project' : 'No project')}</span>
                <span>{formatDuration(task.durationMinutes)}</span>
              </div>
              {(task.startTime || task.endTime) && (
                <p className="small text-secondary mt-1 mb-0">
                  {task.startTime ? formatTaskTime(task.startTime, timeZone) : 'No start time'}
                  {' to '}
                  {task.endTime ? formatTaskTime(task.endTime, timeZone) : 'Not ended'}
                </p>
              )}
              {confirmingDelete ? (
                <div className="task-delete-confirm mt-2" role="group" aria-label={`Confirm deletion of ${task.title}`}>
                  <span>Delete this task permanently?</span>
                  <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => { void onDelete(); }}>Confirm delete</button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => setConfirmingDelete(false)}>Keep task</button>
                </div>
              ) : (
                <div className="task-actions mt-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={beginEditing} aria-label={`Edit ${task.title}`}>Edit</button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy || !canMoveUp} onClick={() => { void onMove(-1); }} aria-label={`Move ${task.title} up`}>
                    <i className="bi bi-arrow-up" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy || !canMoveDown} onClick={() => { void onMove(1); }} aria-label={`Move ${task.title} down`}>
                    <i className="bi bi-arrow-down" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => setConfirmingDelete(true)} aria-label={`Delete ${task.title}`}>Delete</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
