import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '../models/preferences';
import type { Project } from '../models/project';
import type { Task, TaskInput } from '../models/task';
import { getPreferences } from '../services/settingsService';
import { getProjects } from '../services/projectService';
import {
  createTask, deleteTask, editTask, getTasks, reorderTasks, setTaskCompleted,
} from '../services/taskService';
import { calculateDurationMinutes } from '../utils/duration';
import { getWorkdayDate, validateWorkdayDate, validateWorkdaySettings } from '../utils/workday';

type LoadedTasks = { date: string; tasks: Task[] };

export function useDailyTimesheet(requestedDate: string | null = null) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectError, setProjectError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const [pinnedDate, setPinnedDate] = useState<string | null>(requestedDate);
  const [loaded, setLoaded] = useState<LoadedTasks | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const [reloadToken, setReloadToken] = useState(0);
  const currentDate = preferences ? getWorkdayDate(clock, preferences) : null;
  const selectedDate = pinnedDate ?? currentDate;
  const activeDate = useRef(selectedDate);
  activeDate.current = selectedDate;

  useEffect(() => {
    setPinnedDate(requestedDate);
  }, [requestedDate]);

  useEffect(() => {
    const tick = () => setClock(new Date());
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setSetupError('');
    setProjectError('');
    void getPreferences(user.uid).then((saved) => {
      const settings = saved ?? DEFAULT_USER_PREFERENCES;
      validateWorkdaySettings(settings);
      if (active) setPreferences(settings);
    }).catch((loadError: unknown) => {
      if (active) setSetupError(loadError instanceof Error ? loadError.message : 'Could not load workday preferences.');
    });
    void getProjects(user.uid).then((saved) => {
      if (active) setProjects(saved);
    }).catch((loadError: unknown) => {
      if (active) setProjectError(loadError instanceof Error ? loadError.message : 'Could not load projects.');
    });
    return () => { active = false; };
  }, [user, reloadToken]);

  useEffect(() => {
    if (!user || !selectedDate) return;
    let active = true;
    setLoaded(null);
    setError('');
    setNotice('');
    void getTasks(user.uid, selectedDate).then((tasks) => {
      if (active) setLoaded({ date: selectedDate, tasks });
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load tasks.');
    });
    return () => { active = false; };
  }, [user, selectedDate, reloadToken]);

  const tasks = loaded?.date === selectedDate ? loaded.tasks : [];
  const loading = !setupError && (!preferences || (loaded?.date !== selectedDate && !error));

  async function mutate(operation: (userId: string, date: string) => Promise<void>, message: string) {
    if (!user || !selectedDate || loaded?.date !== selectedDate) {
      setError('Wait for the selected workday to finish loading before saving.');
      return false;
    }
    if (mutationLock.current) return false;
    const date = selectedDate;
    mutationLock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation(user.uid, date);
      if (activeDate.current === date) setNotice(message);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this change.');
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  async function addTask(taskId: string, title: string, projectId: string | null) {
    return mutate(async (userId, date) => {
      const targetDate = pinnedDate ?? getWorkdayDate(new Date(), preferences ?? DEFAULT_USER_PREFERENCES);
      const order = Math.max(-1, ...tasks.map((task) => task.sortOrder)) + 1;
      const saved = await createTask(userId, taskId, targetDate, {
        title, projectId, startTime: null, endTime: null,
      }, order);
      if (targetDate !== date) setClock(new Date());
      setLoaded((current) => current?.date === targetDate
        ? { date: targetDate, tasks: [...current.tasks.filter((task) => task.id !== saved.id), saved] }
        : current);
    }, 'Task added.');
  }

  async function updateTask(task: Task, input: TaskInput) {
    return mutate(async (userId, date) => {
      await editTask(userId, task.id, input);
      setLoaded((current) => current?.date === date ? {
        date, tasks: current.tasks.map((item) => item.id === task.id ? {
          ...item, ...input, title: input.title.trim(),
          durationMinutes: calculateDurationMinutes(input.startTime, input.endTime),
        } : item),
      } : current);
    }, 'Task saved.');
  }

  async function toggleTask(task: Task) {
    return mutate(async (userId, date) => {
      await setTaskCompleted(userId, task.id, !task.isCompleted);
      setLoaded((current) => current?.date === date ? {
        date, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, isCompleted: !task.isCompleted } : item),
      } : current);
    }, task.isCompleted ? 'Task reopened.' : 'Task completed.');
  }

  async function removeTask(task: Task) {
    return mutate(async (userId, date) => {
      await deleteTask(userId, task.id);
      setLoaded((current) => current?.date === date
        ? { date, tasks: current.tasks.filter((item) => item.id !== task.id) } : current);
    }, 'Task deleted.');
  }

  async function moveTask(task: Task, direction: -1 | 1) {
    return mutate(async (userId, date) => {
      const group = tasks.filter((item) => item.isCompleted === task.isCompleted);
      const index = group.findIndex((item) => item.id === task.id);
      const adjacent = group[index + direction];
      if (!adjacent) throw new Error('The task cannot be moved farther in this list.');
      const reordered = [...tasks];
      const first = reordered.findIndex((item) => item.id === task.id);
      const second = reordered.findIndex((item) => item.id === adjacent.id);
      [reordered[first], reordered[second]] = [reordered[second], reordered[first]];
      await reorderTasks(userId, reordered);
      setLoaded((current) => current?.date === date ? {
        date, tasks: reordered.map((item, sortOrder) => ({ ...item, sortOrder })),
      } : current);
    }, 'Task order saved.');
  }

  function selectDate(date: string | null) {
    if (mutationLock.current) return;
    if (date) validateWorkdayDate(date);
    setPinnedDate(date);
    setClock(new Date());
  }

  const refresh = useCallback(() => {
    if (!mutationLock.current) setReloadToken((token) => token + 1);
  }, []);

  return {
    userId: user?.uid, preferences, projects, tasks, projectError,
    error: setupError || error, notice, loading, busy, selectedDate, currentDate,
    ready: !!selectedDate && loaded?.date === selectedDate && !!preferences && !setupError,
    selectDate, refresh, addTask, updateTask, toggleTask, removeTask, moveTask,
  };
}
