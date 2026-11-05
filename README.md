# TimeNest

TimeNest is a personal timesheet and task-tracking application. Phases 1-4 provide authentication, settings and projects, a daily timesheet, and weekly/monthly reports. Excel export, AI, and offline support are not implemented.

## Requirements

- Node.js 22 or newer
- npm
- A Firebase project with a web app, Email/Password Authentication, and Cloud Firestore enabled
- JDK 21 or newer (only required to run the Firestore emulator tests)

## Configure Firebase

New to Firebase? Follow the [step-by-step Firebase setup guide](./docs/firebase-setup.md). It covers creating the project, finding each web configuration value, enabling sign-in, creating Firestore, deploying the security rules, and configuring local development and GitHub Pages.

The app stops at a setup screen when its Firebase web configuration is missing. Firebase Auth sessions persist in the browser; private task, project, and preference documents live under `users/{userId}` and are protected by the Firestore rules. Data loads when a workday, report, or settings page opens; use **Refresh tasks** or **Refresh report** to see changes made on another device. Realtime and offline synchronization are not enabled.

## Daily Timesheet

- The default workday runs from **4:00 PM to 1:00 AM the following calendar day**, in **America/Chicago**. The workday date rolls over at 4:00 PM, not midnight; entries before 4:00 PM belong to the previous workday.
- Saved workday start/end and IANA time-zone preferences are honored. All current-day selection uses the shared workday utility and daylight-saving-aware conversion.
- Type a description and press **Enter** to save. The input clears and refocuses after confirmation. Project assignment is optional and AI is never involved.
- Previous/next day, the date picker, and **Current workday** load the selected day's saved tasks. Current workday follows rollover automatically; explicitly selected historical days stay selected.
- Use a checkbox to complete or reopen a task. Completed tasks remain stored and contribute to the daily total.
- **Edit** opens an inline form for the title, project, and start/end dates and times. Times are interpreted in the saved time zone, not the browser's zone. For an overnight task, set the end date to the following day.
- Actual time instants are stored as UTC Firestore timestamps separately from `taskDate`. Duration is elapsed UTC time rounded to the nearest whole minute; untimed or start-only tasks contribute zero. An end without a start, backwards ranges, nonexistent DST times, and ambiguous repeated DST times are rejected with an error.
- Up/down controls reorder tasks within pending or completed groups. Ordering is persisted atomically (up to Firestore's 500-write batch limit per workday).
- Deletion requires inline confirmation. Failed saves keep your input; an explicit retry of the same quick-entry submission reuses its stable ID to avoid duplicates. Internet access is required for saving.

**Deploy the updated Firestore rules before using Phase 3:**

```sh
npx firebase deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

The updated rules enforce valid task time ranges, consistent duration, and nonnegative integer ordering as well as user isolation.

## Weekly and monthly reports

- **Weekly View** uses Monday-Sunday weeks. **Monthly Report** uses calendar months of stored workday dates. Both open the period containing the current workday, honoring saved rollover and time-zone preferences; before 4:00 PM on the first calendar day of a month, the default workday still belongs to the previous month.
- Use previous/next/current period buttons or select a date (weekly) or month and year (monthly). Click any day's heading to open that exact workday in Daily Timesheet.
- Reports include pending and completed tasks, daily and period totals, project totals, task/status counts, and **workdays with recorded tasks**. A workday with an untimed task counts as recorded even when its total is zero. Empty days are displayed but do not count as recorded workdays.
- Filter by a specific project, **No project**, or **All projects**, and optionally narrow the inclusive from/through dates within the selected period. Totals and counts reflect these filters. Date filters reset when the reporting period changes; the project selection stays selected. **Clear filters** restores the full period and all projects.
- Inactive and unavailable/deleted projects remain visible in historical reports. Completed tasks are never removed from totals.
- Reports sum the same stored integer minutes as Daily Timesheet, without independently rounding hours or rebucketing overnight/DST tasks by their UTC timestamps. Start/end times display in the saved time zone; `taskDate` remains the authoritative workday assignment.
- **Refresh report** reloads saved preferences, projects, and the selected period's tasks. Loading and failures are shown explicitly; retry does not show an empty successful report after an error.
- Phase 4 needs no new Firebase configuration or rule changes if the Phase 3 rules are already deployed. Range queries use the existing single-field `taskDate` index (no new composite index).
- Excel export is reserved for Phase 5 and is not available yet.

## Run locally

```sh
npm ci
npm run dev
```

## Tests

```sh
npm test
```

Runs workday rollover/DST, date/time validation, daily UI lifecycle, report calculations, filters, navigation, and report error/loading tests without contacting Firebase.

```sh
npm run test:firebase
```

Runs the checked-in rules tests and actual task-service CRUD/persistence and inclusive report-range tests against the local Firestore emulator. Requires Java 21 or newer; does not use the live Firebase project or `.env` credentials.

```sh
npm run test:rules
```

Runs only the Firestore ownership and document-validation rules tests.

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
├── hooks/                # Daily timesheet and report state/operations
├── models/               # Typed task, project, and preference models
├── pages/                # Route pages, sign-in, and setup screens
├── services/             # Firebase initialization and Firestore access
├── utils/                # Shared workday, date/time, duration, and report rules
└── styles/               # Application-specific styles
firestore.rules           # User-scoped Firestore access control
tests/                    # Business-rule, UI, and Firestore emulator tests
```

See [plan.md](./plan.md) for the product requirements and phased development plan.
