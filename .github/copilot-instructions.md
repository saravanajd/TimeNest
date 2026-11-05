# GitHub Copilot Instructions – TimeNest

You are working on **TimeNest**, a personal timesheet and task-tracking application.

## Source of truth

- Read `plan.md` before implementing features.
- `plan.md` contains the project identity, technology stack, business rules, data model, development phases, and acceptance criteria.
- If a request conflicts with the plan, explain the conflict and ask before changing an important architectural or business decision.

## Development workflow

1. Inspect the repository before making changes.
2. Identify the current phase in `plan.md`.
3. Work only on the phase the user has authorized.
4. Do not start another phase without explicit user approval.
5. Make small, reviewable changes.
6. Do not claim work is complete unless it is implemented and verified.
7. At the end, summarize changed files, features, tests, build results, and remaining issues.

## Technical standards

- Use React, TypeScript, and Vite.
- Use Bootstrap 5 and Bootstrap Icons for the UI.
- Use Firebase Authentication and Firestore through a dedicated service layer.
- Use ExcelJS for Excel export.
- Use GitHub Actions for GitHub Pages deployment.
- Keep UI, business logic, data access, and export logic separated.
- Prefer small reusable components and typed models.
- Avoid unnecessary dependencies.
- Keep the app responsive and accessible.
- Use clear loading, empty, success, and error states.

## Critical business rules

- Project name and application branding: **TimeNest**.
- Workday starts at **4:00 PM** and ends at **1:00 AM the next calendar day**.
- Workday time zone: **`America/Chicago`**.
- Use the IANA time zone and daylight-saving-aware date/time operations. Never hardcode UTC-6 or UTC-5.
- The workday date rolls over at 4:00 PM local time, not midnight.
- Store the workday date separately from actual UTC timestamps.
- Centralize workday date calculation in one reusable utility and test it.
- Tasks entered after midnight and before 4:00 PM belong to the previous workday.

## Task-entry UX

- Daily Timesheet is the default landing page.
- Open the current workday and load its existing tasks automatically.
- Typing a task and pressing Enter creates it.
- Clear and refocus the input after successful creation.
- Do not use a modal for ordinary task creation or editing.
- Completing a task changes its status; it does not delete it.
- Support editing, reopening, deletion, and reordering.
- Project assignment is optional.
- Task creation and saving must never depend on AI availability.

## Security and privacy

- Never commit API keys, service-account credentials, private task data, or secrets.
- Never expose an AI provider key in frontend code or browser storage.
- Enforce user-scoped Firestore security rules; do not rely only on client-side filtering.
- Do not weaken authentication or database rules to make a test pass.
- Use `.env.example` for variable names and placeholders only.
- Remember that the GitHub repository and GitHub Pages site may be public.

## Testing and verification

- Add or update automated tests for important business rules.
- Test workday rollover at 3:59 PM and 4:00 PM in `America/Chicago`.
- Include tests around daylight-saving transitions.
- Test task creation, completion, reopening, editing, and deletion.
- Test report calculations and Excel export when those phases are authorized.
- Run relevant tests, TypeScript checks, and the production build after significant changes.
- Report commands run and their actual results. Do not fabricate test results.

## Phase completion report

At the end of each authorized phase, provide:
1. Files created or modified.
2. Features implemented.
3. Tests and commands executed.
4. Actual test and build results.
5. Acceptance criteria satisfied and outstanding.
6. Decisions or configuration still required.
7. Suggested next phase.

Wait for explicit user approval before moving to the next phase.
