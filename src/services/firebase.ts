import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
};

const configValues = Object.values(firebaseConfig);

export const firebaseConfigured = configValues.every(
  (value) => value.trim().length > 0 && !value.startsWith('your-'),
);

export const missingFirebaseConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value.trim() || value.startsWith('your-'))
  .map(([key]) => `VITE_FIREBASE_${key === 'apiKey' ? 'API_KEY' : key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);

export type FirebaseServices = {
  auth: Auth;
  firestore: Firestore;
};

let firebaseServicesPromise: Promise<FirebaseServices> | undefined;
let firestoreInstance: Firestore | null = null;

export function getFirestoreInstance() {
  return firestoreInstance;
}

export function getFirebaseServices(): Promise<FirebaseServices> {
  if (!firebaseConfigured) {
    return Promise.reject(new Error('Firebase is not configured.'));
  }

  if (!firebaseServicesPromise) {
    firebaseServicesPromise = Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore/lite'),
    ])
      .then(([appSdk, authSdk, firestoreSdk]) => {
        const app = appSdk.getApps()[0] ?? appSdk.initializeApp(firebaseConfig);
        const services = {
          auth: authSdk.getAuth(app),
          firestore: firestoreSdk.getFirestore(app),
        };
        firestoreInstance = services.firestore;
        return services;
      })
      .catch((error: unknown) => {
        firebaseServicesPromise = undefined;
        throw error;
      });
  }

  return firebaseServicesPromise;
}
