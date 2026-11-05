import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '../models/preferences';
import type { Project } from '../models/project';
import type { Task } from '../models/task';
import { getPreferences } from '../services/settingsService';
import { getProjects } from '../services/projectService';
import { getTasksInRange } from '../services/taskService';
import { getWorkdayDate, validateWorkdayDate, validateWorkdaySettings } from '../utils/workday';
import { getReportRange, type ReportPeriod } from '../utils/reports';

export function useTaskReport(period: ReportPeriod) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<{ uid: string; refreshToken: number; preferences: UserPreferences; projects: Project[] } | null>(null);
  const [setupError, setSetupError] = useState('');
  const [anchor, setAnchor] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [refreshToken, setRefreshToken] = useState(0);
  const [result, setResult] = useState<{ key: string; tasks: Task[]; error: string } | null>(null);
  const currentSettings = settings?.uid === user?.uid && settings?.refreshToken === refreshToken ? settings : null;
  const date = currentSettings ? anchor ?? getWorkdayDate(clock, currentSettings.preferences) : null;
  const range = date ? getReportRange(date, period) : null;
  const key = range && user ? `${user.uid}:${range.start}:${range.end}:${refreshToken}` : '';

  useEffect(() => {
    const tick = () => setClock(new Date());
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setSetupError('');
    void Promise.all([getPreferences(user.uid), getProjects(user.uid)]).then(([saved, projects]) => {
      const preferences = saved ?? DEFAULT_USER_PREFERENCES;
      validateWorkdaySettings(preferences);
      if (active) setSettings({ uid: user.uid, refreshToken, preferences, projects });
    }).catch((error: unknown) => {
      if (active) setSetupError(error instanceof Error ? error.message : 'Could not load report settings.');
    });
    return () => { active = false; };
  }, [user, refreshToken]);

  const start = range?.start;
  const end = range?.end;
  useEffect(() => {
    if (!user || !start || !end) return;
    let active = true;
    void getTasksInRange(user.uid, start, end).then((tasks) => {
      if (active) setResult({ key, tasks, error: '' });
    }).catch((error: unknown) => {
      if (active) setResult({ key, tasks: [], error: error instanceof Error ? error.message : 'Could not load report tasks.' });
    });
    return () => { active = false; };
  }, [user, start, end, key]);

  const currentResult = result?.key === key ? result : null;
  function selectDate(value: string | null) {
    if (value) {
      validateWorkdayDate(value);
      getReportRange(value, period);
    }
    setAnchor(value);
    setClock(new Date());
  }
  return {
    date, range, preferences: currentSettings?.preferences, projects: currentSettings?.projects ?? [],
    tasks: currentResult?.tasks ?? [], error: setupError || currentResult?.error || '',
    loading: !setupError && (!currentSettings || !currentResult),
    ready: !!currentSettings && !!currentResult && !setupError && !currentResult.error,
    selectDate, refresh: () => setRefreshToken((token) => token + 1),
  };
}
