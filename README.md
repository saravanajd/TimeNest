# TimeNest

TimeNest is a personal timesheet and task-tracking application. The current phase provides Firebase email/password authentication, private Firestore-backed projects and preferences, and the shared application shell. Daily task management is not implemented yet.

## Requirements

- Node.js 22 or newer
- npm
- A Firebase project with a web app, Email/Password Authentication, and Cloud Firestore enabled
- JDK 21 or newer (only required to run the Firestore emulator tests)

## Configure Firebase

New to Firebase? Follow the [step-by-step Firebase setup guide](./docs/firebase-setup.md). It covers creating the project, finding each web configuration value, enabling sign-in, creating Firestore, deploying the security rules, and configuring local development and GitHub Pages.

The app stops at a setup screen when its Firebase web configuration is missing. Firebase Auth sessions persist in the browser; private project and preference documents live under `users/{userId}` and are protected by the Firestore rules. Phase 2 reads persisted data when settings open; realtime and offline synchronization are not enabled.

## Run locally

```sh
npm ci
npm run dev
```

## Test Firestore rules

```sh
npm run test:rules
```

This starts the Firestore emulator and runs ownership, unauthenticated-access, and document-validation tests against the checked-in rules.

## Build

```sh
npm run build
npm run preview
```

## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` deploys the app using `/TimeNest/` as its base path. Set the repository's Pages source to **GitHub Actions**. Add the six `VITE_FIREBASE_*` values from the Firebase web app configuration as GitHub Actions **repository variables** so the deployed app can initialize Firebase. These are client configuration values, not service-account secrets; configure API restrictions in Google Cloud as appropriate.

## Project structure

```text
src/
├── app/                 # App composition and route definitions
├── components/           # Shared UI and application layout
├── contexts/             # Authentication state
├── models/               # Typed task, project, and preference models
├── pages/                # Route pages, sign-in, and setup screens
├── services/             # Firebase initialization and Firestore access
└── styles/               # Application-specific styles
firestore.rules           # User-scoped Firestore access control
tests/                    # Firestore emulator rule tests
```

See [plan.md](./plan.md) for the product requirements and phased development plan.
