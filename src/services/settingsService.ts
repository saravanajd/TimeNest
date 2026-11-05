import { doc, getDoc, serverTimestamp, setDoc, type DocumentData } from 'firebase/firestore/lite';
import type { UserPreferences } from '../models/preferences';
import { requireFirestore } from './firestoreHelpers';
import { validateWorkdaySettings } from '../utils/workday';

function preferencesDocument(userId: string) {
  return doc(requireFirestore(), 'users', userId, 'settings', 'preferences');
}

function parsePreferences(data: DocumentData): UserPreferences {
  if (
    typeof data.timeZone !== 'string' ||
    typeof data.workdayStart !== 'string' ||
    typeof data.workdayEnd !== 'string' ||
    typeof data.aiEnabled !== 'boolean' ||
    !(typeof data.reminderTime === 'string' || data.reminderTime === null)
  ) {
    throw new Error('Stored preferences have an invalid format.');
  }

  return {
    timeZone: data.timeZone,
    workdayStart: data.workdayStart,
    workdayEnd: data.workdayEnd,
    aiEnabled: data.aiEnabled,
    reminderTime: data.reminderTime,
  };
}

export async function getPreferences(userId: string): Promise<UserPreferences | null> {
  const snapshot = await getDoc(preferencesDocument(userId));
  return snapshot.exists() ? parsePreferences(snapshot.data()) : null;
}

export async function savePreferences(userId: string, preferences: UserPreferences) {
  validateWorkdaySettings(preferences);
  await setDoc(
    preferencesDocument(userId),
    {
      ...preferences,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
