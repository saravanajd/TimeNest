# TimeNest

TimeNest is a personal timesheet and task-tracking application. This initial project shell includes responsive navigation and placeholder routes; task management and data services are planned for later phases.

## Requirements

- Node.js 22 or newer
- npm

## Run locally

```sh
npm ci
npm run dev
```

Local development uses the root URL by default. To override the Vite base path, set `VITE_BASE_PATH` in a local `.env` file. Start from `.env.example`; do not commit `.env` files.

## Build

```sh
npm run build
npm run preview
```

## Deployment

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds the app with `/TimeNest/` as its base path and deploys the `dist` artifact to GitHub Pages. The repository's Pages source must be set to **GitHub Actions** in repository settings.

The app uses hash-based routes so direct navigation and refreshes work on GitHub Pages without a server-side rewrite.

## Project structure

```text
src/
├── app/                 # App composition and route definitions
├── components/
│   ├── common/          # Shared UI elements
│   └── layout/          # Application shell and navigation
├── pages/               # Route-level page components
└── styles/              # Application-specific styles
```

See [plan.md](./plan.md) for the product requirements and phased development plan.
