import { useRef, useState, type FormEvent } from 'react';
import type { Project } from '../../models/project';
import { newTaskId } from '../../services/taskService';

type QuickTaskEntryProps = {
  userId: string;
  projects: Project[];
  disabled: boolean;
  onCreate: (taskId: string, title: string, projectId: string | null) => Promise<boolean>;
};

export default function QuickTaskEntry({ userId, projects, disabled, onCreate }: QuickTaskEntryProps) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const submissionId = useRef<string | null>(null);
  const locked = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || locked.current) return;
    setError('');
    if (!title.trim()) {
      setError('Enter a task description.');
      input.current?.focus();
      return;
    }
    locked.current = true;
    setSaving(true);
    try {
      submissionId.current ??= newTaskId(userId);
      if (await onCreate(submissionId.current, title, projectId || null)) {
        setTitle('');
        submissionId.current = null;
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add the task.');
    } finally {
      locked.current = false;
      setSaving(false);
      input.current?.focus();
    }
  }

  return (
    <section className="settings-panel" aria-labelledby="quick-entry-title">
      <h2 id="quick-entry-title" className="h5">Add a task</h2>
      <form onSubmit={submit}>
        <div className="row g-2 align-items-end">
          <div className="col-lg">
            <label className="form-label" htmlFor="task-title">Task description</label>
            <input
              ref={input} id="task-title" className="form-control" maxLength={1000}
              placeholder="What are you working on? Press Enter to save."
              readOnly={saving} disabled={disabled && !saving} value={title}
              onChange={(event) => { setTitle(event.target.value); submissionId.current = null; }}
              aria-describedby={error ? 'quick-entry-error' : 'quick-entry-help'}
              aria-invalid={!!error}
            />
          </div>
          <div className="col-sm-8 col-lg-3">
            <label className="form-label" htmlFor="task-project">Project (optional)</label>
            <select
              id="task-project" className="form-select" value={projectId} disabled={disabled || saving}
              onChange={(event) => { setProjectId(event.target.value); submissionId.current = null; }}
            >
              <option value="">No project</option>
              {projects.filter((project) => project.isActive).map((project) =>
                <option key={project.id} value={project.id}>{project.name}</option>,
              )}
            </select>
          </div>
          <div className="col-sm-4 col-lg-auto">
            <button className="btn btn-primary w-100" disabled={disabled || saving} type="submit">
              {saving ? 'Saving...' : 'Add task'}
            </button>
          </div>
        </div>
        <p id="quick-entry-help" className="form-text mb-0">Enter saves without a modal. Task saving never uses AI.</p>
        {error && <p id="quick-entry-error" role="alert" className="text-danger mt-2 mb-0">{error}</p>}
      </form>
    </section>
  );
}
