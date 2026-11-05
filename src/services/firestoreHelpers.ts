import type { Timestamp } from 'firebase/firestore/lite';
import { getFirestoreInstance } from './firebase';

export function requireFirestore() {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    throw new Error('Firebase is not configured. Add the Firebase web app settings to your environment.');
  }
  return firestore;
}

function isTimestamp(value: unknown): value is Timestamp {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  );
}

export function timestampToDate(value: unknown): Date | null {
  return isTimestamp(value) ? value.toDate() : null;
}
