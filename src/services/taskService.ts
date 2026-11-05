import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch, type DocumentData,
} from 'firebase/firestore/lite';
import type { Task, TaskInput } from '../models/task';
import { calculateDurationMinutes } from '../utils/duration';
import { validateWorkdayDate } from '../utils/workday';
import { validateDateRange } from '../utils/reports';
import { requireFirestore, timestampToDate } from './firestoreHelpers';

function tasksCollection(userId: string) {
  if (!userId || userId.includes('/')) {
    throw new Error('A valid signed-in user is required.');
  }
  return collection(requireFirestore(), 'users', userId, 'tasks');
}

function taskDocument(userId: string, taskId: string) {
  if (!taskId || taskId.includes('/')) throw new Error('A valid task ID is required.');
  return doc(tasksCollection(userId), taskId);
}

function prepareTaskInput(input: TaskInput) {
  const title = input.title.trim();
  if (!title || title.length > 1000) {
    throw new Error('Enter a task description between 1 and 1,000 characters.');
  }
  if (input.projectId !== null && (!input.projectId.trim() || input.projectId.includes('/'))) {
    throw new Error('Select a valid project or leave it unassigned.');
  }
  return { ...input, title, durationMinutes: calculateDurationMinutes(input.startTime, input.endTime) };
}

function parseTask(id: string, data: DocumentData): Task {
  const createdAt = timestampToDate(data.createdAt);
  const updatedAt = timestampToDate(data.updatedAt);
  const startTime = timestampToDate(data.startTime);
  const endTime = timestampToDate(data.endTime);
  if (typeof data.taskDate !== 'string' || typeof data.title !== 'string' ||
      !(data.projectId === null || typeof data.projectId === 'string') ||
      !(data.improvedTitle === null || typeof data.improvedTitle === 'string') ||
      typeof data.isCompleted !== 'boolean' ||
      !Number.isSafeInteger(data.sortOrder) || data.sortOrder < 0 ||
      !Number.isSafeInteger(data.durationMinutes) || data.durationMinutes < 0 ||
      !createdAt || !updatedAt ||
      (data.startTime !== null && !startTime) || (data.endTime !== null && !endTime)) {
    throw new Error(`Task ${id} has invalid stored data.`);
  }
  validateWorkdayDate(data.taskDate);
  const task: Task = {
    id, taskDate: data.taskDate, title: data.title, projectId: data.projectId,
    improvedTitle: data.improvedTitle, startTime, endTime,
    isCompleted: data.isCompleted, sortOrder: data.sortOrder,
    durationMinutes: data.durationMinutes, createdAt, updatedAt,
  };
  prepareTaskInput(task);
  if (calculateDurationMinutes(startTime, endTime) !== task.durationMinutes) {
    throw new Error(`Task ${id} has an inconsistent duration.`);
  }
  return task;
}

export function newTaskId(userId: string): string {
  return doc(tasksCollection(userId)).id;
}

export async function getTasks(userId: string, taskDate: string): Promise<Task[]> {
  validateWorkdayDate(taskDate);
  const snapshot = await getDocs(query(tasksCollection(userId), where('taskDate', '==', taskDate)));
  return snapshot.docs.map((item) => parseTask(item.id, item.data()))
    .sort((a, b) => a.sortOrder - b.sortOrder ||
      a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
}

export async function getTasksInRange(userId: string, start: string, end: string): Promise<Task[]> {
  validateDateRange({ start, end });
  const snapshot = await getDocs(query(
    tasksCollection(userId), where('taskDate', '>=', start), where('taskDate', '<=', end),
  ));
  return snapshot.docs.map((item) => parseTask(item.id, item.data())).sort((a, b) =>
    a.taskDate.localeCompare(b.taskDate) || a.sortOrder - b.sortOrder ||
    a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
}

export async function createTask(
  userId: string, taskId: string, taskDate: string, input: TaskInput, sortOrder: number,
): Promise<Task> {
  validateWorkdayDate(taskDate);
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) throw new Error('Invalid task order.');
  const prepared = prepareTaskInput(input);
  const reference = taskDocument(userId, taskId);

  // A stable submission ID lets an explicit retry reuse the task after an uncertain network result.
  const existing = await getDoc(reference);
  if (existing.exists()) {
    const task = parseTask(existing.id, existing.data());
    if (task.taskDate !== taskDate || task.title !== prepared.title || task.projectId !== prepared.projectId ||
        task.startTime?.getTime() !== prepared.startTime?.getTime() ||
        task.endTime?.getTime() !== prepared.endTime?.getTime()) {
      throw new Error('This submission ID already belongs to another task. Reload before retrying.');
    }
    return task;
  }
  await setDoc(reference, {
    ...prepared, taskDate, sortOrder, isCompleted: false, improvedTitle: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  const saved = await getDoc(reference);
  if (!saved.exists()) throw new Error('The saved task could not be read. Retry or refresh to confirm its status.');
  return parseTask(saved.id, saved.data());
}

export async function editTask(userId: string, taskId: string, input: TaskInput) {
  await updateDoc(taskDocument(userId, taskId), {
    ...prepareTaskInput(input), updatedAt: serverTimestamp(),
  });
}

export async function setTaskCompleted(userId: string, taskId: string, isCompleted: boolean) {
  await updateDoc(taskDocument(userId, taskId), { isCompleted, updatedAt: serverTimestamp() });
}

export async function deleteTask(userId: string, taskId: string) {
  await deleteDoc(taskDocument(userId, taskId));
}

export async function reorderTasks(userId: string, tasks: Task[]) {
  if (!tasks.length) throw new Error('Select tasks to reorder.');
  if (tasks.length > 500) {
    throw new Error('Atomic reordering supports at most 500 tasks in a workday.');
  }
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length ||
      tasks.some((task) => task.taskDate !== tasks[0].taskDate)) {
    throw new Error('Only distinct tasks from the same workday can be reordered.');
  }
  const batch = writeBatch(requireFirestore());
  tasks.forEach((task, sortOrder) => {
    batch.update(taskDocument(userId, task.id), { sortOrder, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}
