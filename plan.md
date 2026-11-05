# TimeNest – Project Development Plan

## 1. Project Identity

- **Project name:** TimeNest
- **Application type:** Personal timesheet and task tracker
- **Repository name:** `TimeNest`
- **Application display name:** TimeNest
- **Description:** A simple personal application to record daily work, track time, manage tasks, review work history, and generate monthly timesheets.

## 2. Project Overview

Build a fast, reliable, responsive timesheet application for personal use. The primary experience is a daily task list where tasks can be captured quickly, similar to Microsoft To Do.

The application must make it easy to:
- Open the current workday and see tasks already recorded for it.
- Add a task by typing its description and pressing Enter.
- Complete, reopen, edit, delete, and reorder tasks.
- Record start/end times and calculate durations.
- Review work by day, week, and month.
- Export a professional monthly Excel timesheet.
- Optionally improve task descriptions with AI, always with user approval.
- Synchronize data across devices and support offline use where practical.

Build the core timesheet experience before adding AI or advanced features.

## 3. Technology Stack

| Area | Technology |
|---|---|
| Frontend | React |
| Language | TypeScript |
| Build tool | Vite |
| UI | Bootstrap 5 |
| Icons | Bootstrap Icons |
| Database | Firebase Firestore |
| Authentication | Firebase Authentication |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |
| Excel export | ExcelJS |
| Date/time | date-fns and date-fns-tz |
| App experience | Progressive Web App (PWA) |

Keep Firebase access behind a small service layer so the data provider can be changed later if necessary.

**Security:** Never commit private task data, credentials, service-account files, or AI API keys to the public repository. Frontend Firebase configuration is not a substitute for Firestore security rules. Restrict access using authentication and user-scoped rules.

## 4. Core Business Rules

### 4.1 Work schedule and time zone

- Workday starts at **4:00 PM**.
- Workday ends at **1:00 AM the following calendar day**.
- Workday time zone is **`America/Chicago`**.
- Use the IANA time-zone identifier so daylight-saving changes are handled automatically.
- Do not hardcode UTC-6 or UTC-5.
- Store actual instants/timestamps in UTC and convert to/from the configured time zone for display and calculations.

### 4.2 Workday date

The timesheet workday changes at 4:00 PM local time, not at midnight.

Examples:

| Local date/time | Timesheet workday |
|---|---|
| Nov 5, 3:59 PM | Nov 4 |
| Nov 5, 4:00 PM | Nov 5 |
| Nov 5, 11:30 PM | Nov 5 |
| Nov 6, 12:30 AM | Nov 5 |
| Nov 6, 1:00 PM | Nov 5 |
| Nov 6, 4:00 PM | Nov 6 |

Implement one reusable, thoroughly tested workday-date utility. All pages and task creation flows must use it. Do not duplicate workday calculations in UI components.

### 4.3 Task behavior

- Every task belongs to a `taskDate`, which is the workday date, not necessarily the calendar date when the task was entered.
- Saving a task must not depend on AI.
- Pressing Enter in the quick-entry field creates a task.
- After creation, clear and refocus the input so another task can be entered immediately.
- Load existing tasks automatically when a workday is opened.
- Completion is a status change, not deletion.
- Completed tasks remain available in reports and exports.
- Support inline editing, reopening, deletion, and reordering.
- Project/category assignment is optional.
- Handle empty descriptions and invalid time ranges gracefully.

## 5. Application Pages

### 5.1 Daily Timesheet (default landing page)

Features:
- Open the current workday automatically.
- Display the selected workday date clearly.
- Previous day, next day, and current workday navigation.
- Load existing tasks for the selected workday.
- Quick task entry; Enter saves without opening a modal.
- Clear and refocus the entry field after saving.
- Complete/reopen tasks with a checkbox.
- Inline task editing.
- Delete and reorder tasks.
- Optional project/category assignment.
- Start time, end time, and duration.
- Daily total hours.
- Clear separation of pending and completed tasks.
- Useful empty state when no tasks exist.

Avoid modal dialogs for ordinary task creation or editing.

### 5.2 Weekly View

Features:
- Display a selected week grouped by workday.
- Show daily totals and weekly total hours.
- Previous/next week navigation.
- Open a selected day in Daily Timesheet.
- Indicate days with no recorded tasks.

### 5.3 Monthly Report

Features:
- Select month and year.
- Show daily task details and daily totals.
- Show monthly total hours and number of workdays.
- Show project-wise hours.
- Filter by project.
- Include completed and pending tasks.
- Export the selected month to Excel.

### 5.4 Settings

Features:
- Workday start and end times.
- Time zone.
- Project/category management.
- AI description improvement preference.
- Reminder preferences (optional).
- Data backup and restore.

Initial defaults:
- Time zone: `America/Chicago`
- Workday start: `4:00 PM`
- Workday end: `1:00 AM`

## 6. Firestore Data Model

Use user-scoped collections. Suggested structure:

```text
users/{userId}
users/{userId}/tasks/{taskId}
users/{userId}/projects/{projectId}
users/{userId}/settings/preferences
```

### 6.1 Task document

Suggested fields:

| Field | Type | Description |
|---|---|---|
| `taskDate` | string (`YYYY-MM-DD`) | Workday date in `America/Chicago` |
| `title` | string | Original task description |
| `improvedTitle` | string or null | AI suggestion accepted by the user, if any |
| `projectId` | string or null | Optional project |
| `startTime` | timestamp or null | Task start instant |
| `endTime` | timestamp or null | Task end instant |
| `durationMinutes` | number | Duration in minutes |
| `isCompleted` | boolean | Completion status |
| `sortOrder` | number | Display order |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Last update time |

Use a stable document ID. Avoid storing redundant values unless there is a clear reason. Define how duration is calculated and ensure it is consistent between the UI and reports.

### 6.2 Project document

Suggested fields:
- `name`
- `description`
- `isActive`
- `createdAt`
- `updatedAt`

### 6.3 Preferences document

Suggested fields:
- `timeZone`
- `workdayStart`
- `workdayEnd`
- `aiEnabled`
- `reminderTime` (optional)

### 6.4 Firestore security

- Require authentication for all private data.
- A user may read/write only documents under their own `users/{userId}` path where `request.auth.uid == userId`.
- Add and test Firestore security rules before storing real data.
- Do not rely on client-side filtering for privacy.
- Add required Firestore indexes when queries require them.

## 7. AI Features (later phase)

AI must be optional, non-blocking, and user-approved.

### 7.1 Improve task descriptions

Example input:
> fixed invoice payment issue wrong amount calculating

Possible suggestion:
> Fixed an issue in invoice payment allocation that caused incorrect payment amounts to be calculated.

Requirements:
- Preserve the original task description.
- Show original and suggested wording.
- Let the user accept, edit, or reject the suggestion.
- Never silently replace a task.
- Preserve technical terms such as QuickBooks, DevExpress, Kansas tax withholding, invoice payment allocation, compensated absences, and payroll liabilities.
- Do not invent work or claim an issue was fixed unless the original note says it was fixed.

### 7.2 Monthly review

Before export, optionally:
- Identify unclear descriptions.
- Suggest clearer professional wording.
- Identify possible duplicate or similar entries.
- Suggest combining related descriptions for the user's review.

### 7.3 AI security

- Call AI through a protected server-side endpoint.
- Never put an AI provider secret in React code, browser storage, or the public repository.
- Check current provider and hosting requirements before selecting a serverless implementation.
- AI failures must not prevent task creation, editing, or export.

## 8. Excel Export

Use ExcelJS to generate a workbook for the selected month.

### Worksheet 1 – Monthly Summary

Include:
- Month and year.
- Number of workdays with recorded work.
- Total tasks.
- Completed and pending task counts.
- Total hours.
- Project-wise hours.

### Worksheet 2 – Detailed Timesheet

Suggested columns:

| Date | Project | Task Description | Start Time | End Time | Hours | Status |
|---|---|---|---|---|---|---|

Formatting:
- Professional title and header styling.
- Appropriate date/time/number formats.
- Readable column widths.
- Filters.
- Frozen header row.
- Daily and monthly totals.
- Project summary.
- Print-friendly page setup.

Use the AI-improved description only when the user has approved it; otherwise export the original title. Exporting must never modify stored records.

## 9. PWA, Offline Use, and Backup

Later, configure the application as a PWA so it can be installed on supported desktop and mobile devices.

- Add an app manifest and suitable icons.
- Configure a service worker for app-shell caching.
- Enable Firestore offline persistence where supported and appropriate.
- Clearly communicate offline/sync status.
- Prevent duplicate task creation during reconnect/synchronization.
- Test multi-tab behavior and browser support.
- Provide JSON export and restore for personal backup.
- Explain that offline availability depends on previously cached data and successful local persistence; do not promise that every operation works offline in every browser.

## 10. Development Phases and Acceptance Criteria

Implement one phase at a time. Do not begin the next phase until the current phase is reviewed and approved.

### Phase 1 – Project setup and deployment

Tasks:
1. Create React + TypeScript + Vite project.
2. Configure Bootstrap 5 and Bootstrap Icons.
3. Create the initial folder structure.
4. Add routing and shared application layout.
5. Set the browser title and visible branding to TimeNest.
6. Add environment variable examples without secrets.
7. Configure GitHub Actions for GitHub Pages deployment.
8. Add a useful README.

Acceptance criteria:
- App installs dependencies and runs locally.
- Production build succeeds.
- GitHub Pages deployment works with the correct base path.
- Navigation and responsive shell work.
- No secrets or private data are committed.

### Phase 2 – Firebase authentication and storage

Tasks:
1. Create/configure Firebase project.
2. Integrate Firebase Authentication.
3. Integrate Firestore.
4. Create typed models and service layer.
5. Add user-scoped Firestore security rules.
6. Add settings and project persistence.

Acceptance criteria:
- Authentication works.
- Data persists after refresh and across signed-in devices.
- Security rules prevent access to another user's data.
- No private service credentials are included in the frontend.

### Phase 3 – Daily Timesheet

Tasks:
1. Implement and test workday date calculation.
2. Open the current workday by default.
3. Load existing tasks.
4. Implement quick task creation with Enter.
5. Implement completion/reopening.
6. Implement inline editing, deletion, and reordering.
7. Add optional project assignment.
8. Add start/end time and duration handling.
9. Calculate daily totals.
10. Add day navigation.

Acceptance criteria:
- Task entry is fast and requires no modal.
- The input clears and is ready for the next task.
- Existing tasks load automatically.
- 4:00 PM rollover works in `America/Chicago`.
- After-midnight entries belong to the previous workday until 4:00 PM.
- Changes persist after refresh.

### Phase 4 – Weekly and monthly reports

Tasks:
1. Build weekly view and navigation.
2. Build monthly report and navigation.
3. Calculate daily, weekly, monthly, and project totals.
4. Add project/date filters.

Acceptance criteria:
- Report totals match source task records.
- Completed tasks are included.
- Empty days and tasks without projects are handled.
- Date boundaries use the configured workday rules.

### Phase 5 – Excel export

Tasks:
1. Add ExcelJS.
2. Generate monthly summary worksheet.
3. Generate detailed worksheet.
4. Apply formatting, filters, frozen rows, and totals.
5. Add export action.

Acceptance criteria:
- Export includes all tasks for the selected workday dates.
- Totals match the application.
- Workbook opens correctly in Microsoft Excel.
- Export does not change stored task data.

### Phase 6 – AI integration

Tasks:
1. Select and configure a protected server-side AI endpoint.
2. Add AI settings.
3. Implement description suggestions.
4. Add accept/edit/reject workflow.
5. Add optional monthly review.
6. Handle errors and rate limits gracefully.

Acceptance criteria:
- AI never changes text without approval.
- Original text is preserved.
- Task saving works when AI is disabled or unavailable.
- Secrets remain server-side.

### Phase 7 – PWA, offline support, and backup

Tasks:
1. Configure PWA manifest and icons.
2. Add service worker/app-shell caching.
3. Configure Firestore offline support.
4. Display connectivity and sync status.
5. Add JSON backup and restore.
6. Improve mobile usability.

Acceptance criteria:
- App can be installed on supported browsers.
- Offline and synchronization behavior is tested and explained.
- Backup can be exported and restored safely.

### Phase 8 – Final testing and release

Tasks:
1. Test workday calculations and daylight-saving transitions.
2. Test task CRUD and ordering.
3. Test Firestore security rules.
4. Test report totals and Excel export.
5. Test offline/reconnect behavior.
6. Test desktop and mobile layouts.
7. Review security, accessibility, and error handling.
8. Publish the production release.

## 11. Required Automated Tests

At minimum, test these scenarios:

| Scenario | Expected result |
|---|---|
| Open at 12:30 AM local time | Previous workday opens |
| Open at 3:59 PM | Previous workday opens |
| Open at exactly 4:00 PM | New workday opens |
| Create task and press Enter | Task saves immediately |
| Refresh the page | Saved task remains |
| Complete a task | Task remains in reports |
| Reopen a completed task | Status becomes pending |
| Save without a project | Task saves |
| Enter task offline | Behavior follows tested offline support |
| Reconnect | Pending changes synchronize without duplicates |
| Export a month | Correct workday tasks and totals are included |
| Cross daylight-saving transition | Local workday and timestamps remain correct |

Also test invalid/empty task titles, missing timestamps, end times before start times, duplicate submissions, and tasks spanning midnight.

## 12. Suggested Repository Structure

```text
TimeNest/
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/
│       └── deploy.yml
├── public/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── routes.tsx
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   ├── reports/
│   │   └── tasks/
│   ├── hooks/
│   ├── models/
│   ├── pages/
│   │   ├── DailyTimesheet.tsx
│   │   ├── WeeklyView.tsx
│   │   ├── MonthlyReport.tsx
│   │   └── Settings.tsx
│   ├── services/
│   │   ├── firebase.ts
│   │   ├── taskService.ts
│   │   ├── projectService.ts
│   │   ├── settingsService.ts
│   │   ├── aiService.ts
│   │   └── exportService.ts
│   ├── utils/
│   │   ├── workday.ts
│   │   ├── dateTime.ts
│   │   └── duration.ts
│   └── styles/
├── tests/
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── README.md
└── plan.md
```

## 13. Instructions for GitHub Copilot Agent

You are a senior full-stack developer building **TimeNest**, a personal timesheet and task-tracking application.

Before making changes:
1. Read `plan.md` completely.
2. Read `.github/copilot-instructions.md` completely.
3. Inspect the existing repository and report its current state.
4. Identify the current development phase.

Implementation rules:
- Start with Phase 1 only unless the user explicitly asks for another phase.
- Implement one phase at a time.
- Do not silently skip requirements or acceptance criteria.
- Do not implement future phases prematurely.
- Ask before making choices that materially change the architecture, introduce paid services, or require user secrets.
- Use small, reviewable changes.
- Keep components reusable and business logic separate.
- Use TypeScript types for application models.
- Add tests for important business rules.
- Run tests and a production build after significant changes.
- Never expose credentials, private task data, or AI keys.
- Do not claim a feature is complete unless it is implemented and tested.

At the end of each phase, report:
1. Files created or modified.
2. Features implemented.
3. Tests and commands run.
4. Build/test results.
5. Acceptance criteria met or not met.
6. Outstanding issues and decisions needed.
7. Recommended next phase.

Wait for the user's approval before starting the next phase.

### Initial task

Read the plan and instructions, inspect the repository, and begin **Phase 1 only**. First summarize the implementation approach and proposed file structure. Then implement Phase 1, run the production build, fix errors, and report the results.
