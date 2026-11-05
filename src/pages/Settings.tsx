import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Project } from '../models/project';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '../models/preferences';
import { useAuth } from '../contexts/AuthContext';
import { createProject, deleteProject, getProjects, updateProject } from '../services/projectService';
import { getPreferences, savePreferences } from '../services/settingsService';

function Settings() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingPreferences, setSavingPreferences] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    setError('');
    setProjectsLoading(true);
    setPreferencesLoading(true);
    try {
      const [nextProjects, savedPreferences] = await Promise.all([
        getProjects(user.uid),
        getPreferences(user.uid),
      ]);
      setProjects(nextProjects);
      setPreferences(savedPreferences ?? DEFAULT_USER_PREFERENCES);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load account settings.');
    } finally {
      setProjectsLoading(false);
      setPreferencesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleAddProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setError('');
    setNotice('');
    try {
      await createProject(user.uid, { name: projectName, description: projectDescription });
      await loadSettings();
      setProjectName('');
      setProjectDescription('');
      setNotice('Project added.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add project.');
    }
  }

  async function handleSaveProject(project: Project, updates: Pick<Project, 'name' | 'description' | 'isActive'>) {
    if (!user) return;
    setError('');
    setNotice('');
    try {
      await updateProject(user.uid, project.id, updates);
      await loadSettings();
      setNotice('Project saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save project.');
    }
  }

  async function handleDeleteProject(project: Project) {
    if (!user || !window.confirm(`Delete “${project.name}”?`)) return;
    setError('');
    setNotice('');
    try {
      await deleteProject(user.uid, project.id);
      await loadSettings();
      setNotice('Project deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete project.');
    }
  }

  function updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  async function handleSavePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setError('');
    setNotice('');

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: preferences.timeZone });
    } catch {
      setError('Enter a valid IANA time zone, such as America/Chicago.');
      return;
    }

    setSavingPreferences(true);
    try {
      await savePreferences(user.uid, preferences);
      setNotice('Preferences saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save preferences.');
    } finally {
      setSavingPreferences(false);
    }
  }

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <div className="settings-page__intro">
        <p className="eyebrow mb-1">Your workspace</p>
        <h1 id="settings-title" className="h2 mb-2">Settings</h1>
        <p className="text-secondary mb-0">Manage your projects and saved workday preferences.</p>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <section className="settings-panel" aria-labelledby="preferences-title">
        <div className="settings-panel__heading">
          <div>
            <h2 id="preferences-title" className="h5 mb-1">Workday preferences</h2>
            <p className="text-secondary small mb-0">These defaults are stored with your account.</p>
          </div>
        </div>
        {preferencesLoading ? (
          <p className="text-secondary mb-0">Loading preferences...</p>
        ) : (
          <form onSubmit={handleSavePreferences}>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label" htmlFor="time-zone">Time zone</label>
                <input
                  className="form-control"
                  id="time-zone"
                  onChange={(event) => updatePreference('timeZone', event.target.value)}
                  required
                  value={preferences.timeZone}
                />
                <div className="form-text">Use an IANA time-zone name, for example America/Chicago.</div>
              </div>
              <div className="col-sm-6">
                <label className="form-label" htmlFor="workday-start">Workday starts</label>
                <input
                  className="form-control"
                  id="workday-start"
                  onChange={(event) => updatePreference('workdayStart', event.target.value)}
                  required
                  type="time"
                  value={preferences.workdayStart}
                />
              </div>
              <div className="col-sm-6">
                <label className="form-label" htmlFor="workday-end">Workday ends</label>
                <input
                  className="form-control"
                  id="workday-end"
                  onChange={(event) => updatePreference('workdayEnd', event.target.value)}
                  required
                  type="time"
                  value={preferences.workdayEnd}
                />
              </div>
              <div className="col-12 d-flex justify-content-end">
                <button className="btn btn-primary" disabled={savingPreferences} type="submit">
                  {savingPreferences ? 'Saving...' : 'Save preferences'}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      <section className="settings-panel" aria-labelledby="projects-title">
        <div className="settings-panel__heading">
          <div>
            <h2 id="projects-title" className="h5 mb-1">Projects</h2>
            <p className="text-secondary small mb-0">Keep project names available for future task assignment.</p>
          </div>
          <span className="badge rounded-pill text-bg-light">{projects.length}</span>
        </div>
        <form className="project-create-form" onSubmit={handleAddProject}>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="visually-hidden" htmlFor="new-project-name">Project name</label>
              <input
                className="form-control"
                id="new-project-name"
                maxLength={100}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Project name"
                required
                value={projectName}
              />
            </div>
            <div className="col-md">
              <label className="visually-hidden" htmlFor="new-project-description">Description</label>
              <input
                className="form-control"
                id="new-project-description"
                maxLength={500}
                onChange={(event) => setProjectDescription(event.target.value)}
                placeholder="Description (optional)"
                value={projectDescription}
              />
            </div>
            <div className="col-md-auto">
              <button className="btn btn-primary w-100" type="submit">Add project</button>
            </div>
          </div>
        </form>

        {projectsLoading ? (
          <p className="text-secondary mb-0">Loading projects...</p>
        ) : projects.length === 0 ? (
          <div className="empty-projects">
            <i className="bi bi-folder2-open" aria-hidden="true" />
            <p className="mb-0">No projects yet. Add one above when you’re ready.</p>
          </div>
        ) : (
          <ul className="project-list">
            {projects.map((project) => (
              <ProjectSettingsRow
                key={project.id}
                onDelete={() => handleDeleteProject(project)}
                onSave={(updates) => handleSaveProject(project, updates)}
                project={project}
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

type ProjectSettingsRowProps = {
  project: Project;
  onSave: (updates: Pick<Project, 'name' | 'description' | 'isActive'>) => Promise<void>;
  onDelete: () => Promise<void>;
};

function ProjectSettingsRow({ project, onSave, onDelete }: ProjectSettingsRowProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [isActive, setIsActive] = useState(project.isActive);
  const [saving, setSaving] = useState(false);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ name, description, isActive });
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="project-row">
      <form className="row g-2 align-items-center" onSubmit={handleSave}>
        <div className="col-lg-4">
          <label className="visually-hidden" htmlFor={`project-name-${project.id}`}>Project name</label>
          <input
            className="form-control form-control-sm"
            id={`project-name-${project.id}`}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </div>
        <div className="col-lg">
          <label className="visually-hidden" htmlFor={`project-description-${project.id}`}>Description</label>
          <input
            className="form-control form-control-sm"
            id={`project-description-${project.id}`}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </div>
        <div className="col-sm-auto">
          <div className="form-check">
            <input
              checked={isActive}
              className="form-check-input"
              id={`project-active-${project.id}`}
              onChange={(event) => setIsActive(event.target.checked)}
              type="checkbox"
            />
            <label className="form-check-label small" htmlFor={`project-active-${project.id}`}>Active</label>
          </div>
        </div>
        <div className="col-sm-auto d-flex gap-2">
          <button className="btn btn-outline-primary btn-sm" disabled={saving} type="submit">Save</button>
          <button className="btn btn-outline-danger btn-sm" onClick={onDelete} type="button">Delete</button>
        </div>
      </form>
    </li>
  );
}

export default Settings;
