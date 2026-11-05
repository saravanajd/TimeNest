import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'timenest-rules-test';
let testEnvironment;

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

after(async () => {
  await testEnvironment?.cleanup();
});

test('a signed-in user can create and read their own project', async () => {
  const firestore = testEnvironment.authenticatedContext('alice').firestore();
  const project = doc(firestore, 'users/alice/projects/project-1');
  const now = new Date();

  await assertSucceeds(setDoc(project, {
    name: 'TimeNest',
    description: '',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
  await assertSucceeds(getDoc(project));
});

test('a user cannot read or write another user’s project', async () => {
  const alice = testEnvironment.authenticatedContext('alice').firestore();
  const bobProject = doc(alice, 'users/bob/projects/project-1');
  const now = new Date();

  await assertFails(getDoc(bobProject));
  await assertFails(setDoc(bobProject, {
    name: 'Private',
    description: '',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
});

test('unauthenticated clients cannot access user data', async () => {
  const firestore = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(firestore, 'users/alice/settings/preferences')));
});

test('a signed-in user can save preferences only under their own account', async () => {
  const alice = testEnvironment.authenticatedContext('alice').firestore();
  const preferences = {
    timeZone: 'America/Chicago',
    workdayStart: '16:00',
    workdayEnd: '01:00',
    aiEnabled: false,
    reminderTime: null,
    updatedAt: new Date(),
  };

  await assertSucceeds(setDoc(doc(alice, 'users/alice/settings/preferences'), preferences));
  await assertFails(setDoc(doc(alice, 'users/bob/settings/preferences'), preferences));
});

test('a signed-in user can save tasks only under their own account', async () => {
  const alice = testEnvironment.authenticatedContext('alice').firestore();
  const now = new Date();
  const task = {
    taskDate: '2026-11-05',
    title: 'Review project notes',
    improvedTitle: null,
    projectId: null,
    startTime: null,
    endTime: null,
    durationMinutes: 0,
    isCompleted: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  await assertSucceeds(setDoc(doc(alice, 'users/alice/tasks/task-1'), task));
  await assertFails(setDoc(doc(alice, 'users/bob/tasks/task-1'), task));
});

test('project documents reject unexpected fields', async () => {
  const firestore = testEnvironment.authenticatedContext('alice').firestore();
  const now = new Date();

  await assertFails(setDoc(doc(firestore, 'users/alice/projects/project-1'), {
    name: 'TimeNest',
    description: '',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    privateNote: 'not an allowed field',
  }));
});
