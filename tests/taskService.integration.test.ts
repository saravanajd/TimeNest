import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, type Firestore,
} from 'firebase/firestore/lite';
import { doc as fullDoc, setDoc as fullSetDoc } from 'firebase/firestore';
import { createTask, deleteTask, editTask, getTasks, getTasksInRange, newTaskId, reorderTasks, setTaskCompleted } from '../src/services/taskService';
import { buildReport } from '../src/utils/reports';

const fixture = vi.hoisted(() => ({ database: null as Firestore | null }));
vi.mock('../src/services/firebase', () => ({
  getFirestoreInstance: () => fixture.database,
}));

let environment: RulesTestEnvironment;
const apps: FirebaseApp[] = [];
function client(name: string, uid: string) {
  const app = initializeApp({ projectId: 'timenest-rules-test', apiKey: 'fake-emulator-key' }, name);
  apps.push(app);
  const database = getFirestore(app);
  connectFirestoreEmulator(database, '127.0.0.1', 8080, { mockUserToken: { sub: uid, user_id: uid } });
  return database;
}
const input = { title: 'Review notes', projectId: null, startTime: null, endTime: null };

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'timenest-rules-test',
    firestore: {
      host: '127.0.0.1', port: 8080,
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
  fixture.database = client('timenest-alice', 'alice');
});
beforeEach(async () => {
  await environment.clearFirestore();
  fixture.database = getFirestore(apps[0]);
});
afterAll(async () => {
  await environment?.cleanup();
  await Promise.all(apps.map((app) => deleteApp(app)));
});

describe('actual task service against the Firestore emulator', () => {
  it('queries inclusive workday ranges, includes completed tasks and excludes other dates', async () => {
    const range = { start: '2026-10-31', end: '2026-11-01' };
    await createTask('alice', 'before', '2026-10-30', input, 0);
    await createTask('alice', 'start', range.start, {
      ...input, startTime: new Date('2026-11-01T05:30Z'), endTime: new Date('2026-11-01T08:30Z'),
    }, 0);
    await setTaskCompleted('alice', 'start', true);
    await createTask('alice', 'end', range.end, {
      ...input, projectId: 'project', startTime: new Date('2026-11-01T22:00Z'), endTime: new Date('2026-11-01T22:30Z'),
    }, 0);
    await createTask('alice', 'after', '2026-11-02', input, 0);
    const tasks = await getTasksInRange('alice', range.start, range.end);
    expect(tasks.map((task) => task.id)).toEqual(['start', 'end']);
    expect(buildReport(tasks, range)).toMatchObject({
      totalMinutes: 210, completedCount: 1, pendingCount: 1, workdayCount: 2,
    });
    expect(await getTasksInRange('alice', '2026-12-01', '2026-12-31')).toEqual([]);
    await expect(getTasksInRange('alice', range.end, range.start)).rejects.toThrow(/start/);
    fixture.database = client('timenest-range-bob', 'bob');
    await expect(getTasksInRange('alice', range.start, range.end)).rejects.toThrow();
  });

  it('creates without a project, stores UTC timestamps, and loads from a fresh client', async () => {
    const id = newTaskId('alice');
    const saved = await createTask('alice', id, '2026-11-05', input, 0);
    expect(saved).toMatchObject({ id, taskDate: '2026-11-05', title: 'Review notes', durationMinutes: 0, isCompleted: false });
    expect(saved.createdAt).toBeInstanceOf(Date);
    fixture.database = client('timenest-refresh', 'alice');
    expect(await getTasks('alice', '2026-11-05')).toEqual([saved]);
    expect(await getTasks('alice', '2026-11-04')).toEqual([]);
  });

  it('uses stable IDs to avoid creating a duplicate on explicit retry', async () => {
    const first = await createTask('alice', 'stable-id', '2026-11-05', input, 0);
    const retry = await createTask('alice', 'stable-id', '2026-11-05', input, 0);
    expect(retry.createdAt).toEqual(first.createdAt);
    expect(await getTasks('alice', '2026-11-05')).toHaveLength(1);
    await expect(createTask('alice', 'stable-id', '2026-11-04', input, 0)).rejects.toThrow(/another task/);
  });

  it('completes, reopens, edits overnight times, and deletes persistent records', async () => {
    await createTask('alice', 'task-1', '2026-11-05', input, 0);
    await setTaskCompleted('alice', 'task-1', true);
    expect((await getTasks('alice', '2026-11-05'))[0].isCompleted).toBe(true);
    await setTaskCompleted('alice', 'task-1', false);
    await editTask('alice', 'task-1', {
      title: 'Updated notes', projectId: 'my-project',
      startTime: new Date('2026-11-06T05:30Z'), endTime: new Date('2026-11-06T07:00Z'),
    });
    expect((await getTasks('alice', '2026-11-05'))[0]).toMatchObject({
      isCompleted: false, title: 'Updated notes', projectId: 'my-project', durationMinutes: 90,
      taskDate: '2026-11-05', startTime: new Date('2026-11-06T05:30Z'),
    });
    await deleteTask('alice', 'task-1');
    expect(await getTasks('alice', '2026-11-05')).toEqual([]);
  });

  it('atomically persists ordering even if earlier task sort values collide', async () => {
    const first = await createTask('alice', 'one', '2026-11-05', input, 0);
    const second = await createTask('alice', 'two', '2026-11-05', { ...input, title: 'Second' }, 0);
    await reorderTasks('alice', [second, first]);
    expect((await getTasks('alice', '2026-11-05')).map((task) => task.id)).toEqual(['two', 'one']);
  });

  it('rejects empty titles, invalid dates, and invalid time ranges before writing', async () => {
    await expect(createTask('alice', 'one', '2026-11-05', { ...input, title: ' ' }, 0)).rejects.toThrow(/description/);
    await expect(createTask('alice', 'one', '2026-02-30', input, 0)).rejects.toThrow(/date/);
    await expect(createTask('alice', 'one', '2026-11-05', { ...input, endTime: new Date() }, 0)).rejects.toThrow(/start time/);
    await expect(createTask('alice', 'one', '2026-11-05', {
      ...input, startTime: new Date('2026-11-06T07:00Z'), endTime: new Date('2026-11-06T05:30Z'),
    }, 0)).rejects.toThrow(/before/);
    expect(await getTasks('alice', '2026-11-05')).toEqual([]);
  });

  it('rules protect tasks from another authenticated client', async () => {
    await createTask('alice', 'private-task', '2026-11-05', input, 0);
    fixture.database = client('timenest-bob', 'bob');
    await expect(getTasks('alice', '2026-11-05')).rejects.toThrow();
    await expect(setTaskCompleted('alice', 'private-task', true)).rejects.toThrow();
    await expect(deleteTask('alice', 'private-task')).rejects.toThrow();
  });

  it('rejects inconsistent duration data rather than showing incorrect totals', async () => {
    const saved = await createTask('alice', 'one', '2026-11-05', input, 0);
    const reference = doc(fixture.database!, 'users/alice/tasks/one');
    const document = await getDoc(reference);
    await expect(setDoc(reference, { ...document.data(), durationMinutes: 123 })).rejects.toThrow();
    await environment.withSecurityRulesDisabled(async (context) => {
      await fullSetDoc(fullDoc(context.firestore(), 'users/alice/tasks/one'), {
        ...input, taskDate: saved.taskDate, improvedTitle: null, isCompleted: false, sortOrder: 0,
        durationMinutes: 123, createdAt: saved.createdAt, updatedAt: saved.updatedAt,
      });
    });
    await expect(getTasks('alice', saved.taskDate)).rejects.toThrow(/inconsistent/);
  });
});
