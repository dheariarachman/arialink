# Repository Guidelines

## Design Baseline

Read `DESIGN.md` before UI work. Use it as the baseline for typography, spacing, layout, component geometry, responsiveness, and accessibility. Keep shared measurements in CSS tokens. Its screenshot measurements are estimates and its scope excludes theme colors; do not invent features solely to match its example layout.

## Project Structure & Module Organization

ARIALink is a Next.js/React bookkeeping PWA deployed through OpenNext to Cloudflare Workers with D1 storage.

- `app/`: routes, layout, global CSS, manifest, and API entry point.
- `components/App.jsx`: client UI, forms, dashboard, and reports.
- `lib/`: domain calculations, authentication, API handling, D1 access, and IndexedDB synchronization.
- `public/`: icons and service worker; `migrations/`: numbered D1 SQL migrations such as `0001_initial.sql`.
- `tests/`: domain/API/PWA tests and browser fixtures; `scripts/`: syntax checks and icon generation.
- `docs/`: deployment instructions and recorded verification status.

## Build, Test, and Development Commands

Use Node.js 22.16+ and npm. Install dependencies with `npm install`.

- `npm run db:local`: apply local D1 migrations.
- `npm run dev`: start Next.js development at localhost:3000.
- `npm test`: run Node's built-in test suite, including in-memory SQLite API tests.
- `npm run check`: check JavaScript syntax and package JSON; excludes JSX compilation.
- `npm run build`: compile Next.js and JSX.
- `npm run cf:preview`: build OpenNext and preview the Cloudflare runtime locally.
- `npm run test:browser`: serve the IndexedDB fixture at localhost:4178; open it to inspect results.

Use Cloudflare preview for D1 integration; `npm start` lacks Cloudflare bindings. Development mode does not register the service worker.

## Coding Style & Naming Conventions

Follow surrounding compact JavaScript: ES modules, single quotes, semicolons, and existing local indentation (generally one or two spaces). Use camelCase for functions/variables, PascalCase for React components, and UPPER_SNAKE_CASE for constants. Keep reusable business rules in `lib/domain.mjs`. No ESLint or Prettier configuration is provided.

## Testing Guidelines

Name automated tests `tests/*.test.mjs`; use `node:test` and `node:assert/strict`. No coverage threshold is configured. Add regression cases for changed calculations, authorization, retries, conflicts, and offline behavior. Preserve WIB date boundaries, distinctions between empty values and zero, and manually maintained balances. Use production preview for actual PWA/offline acceptance checks; the browser fixture alone is insufficient.

## Commit & Pull Request Guidelines

Git history is unreadable in this checkout, so no historical convention is verified. Prefer concise imperative commit subjects, such as `Fix offline retry handling`. PRs should describe behavior changes, link relevant issues, report checks and limitations, and include screenshots for UI changes.

## Security & Configuration

Copy `.dev.vars.example` to `.dev.vars` and set a private random `SETUP_TOKEN` of at least 24 characters. Never commit secrets, local databases, or financial backups. Follow `docs/DEPLOYMENT.md` for remote migrations and deployment.
