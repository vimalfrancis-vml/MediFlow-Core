# MediFlow Development Rules

## Server Management (STRICT)
- The Vite frontend and Nodemon backend are always assumed to be running.
- NEVER start, stop, or restart either server unless the user explicitly requests it.
- NEVER run production builds (`npm run build`) during active development.
- If code changes require a server restart to take effect (e.g. new env var), explain why and ask the user to do it manually.

## Post-Sprint Checklist (run in this order)
- Run **only the client TypeScript check** (`npx tsc -b --noEmit`) for UI/CSS and React component changes, then ask user to refresh the browser.
- For **API client** changes, run both client and server TypeScript checks.
- For **backend services/controllers**, run client and server TypeScript checks **plus** any relevant backend tests (`npm test`).
- For **WorkflowEngine, permissions, authentication, or any workflow logic**, execute the full suite of backend tests.
- For **Prisma schema or migrations**, run server TypeScript checks, backend tests, and perform manual verification of the DB changes.
- **Never restart development servers or run production builds** during active development.

## Development Workflow
- Work in feature sprints (3–5 closely related tasks).
- Complete the full sprint before asking for review.
- Run only relevant TypeScript checks and tests.
- Do not perform production builds unless explicitly requested.

## Decision Making
- Do not implement speculative optimizations.
- Verify issues using the current codebase before changing code.
- Prefer business value over architectural perfection.
- Avoid unnecessary refactoring.

## Verification
- Browser verification is required only for user-facing UI changes.
- Backend-only changes should be verified with tests.

## Sprint Completion
At the end of every sprint, always provide:
1. What capability was added.
2. How to verify it.
3. What remains unfinished.
4. Recommended next sprint.

## UI Guidelines
- Use simple, beginner-friendly language.
- Avoid unnecessary technical jargon in user-facing text.
- Keep branding consistent as "MediFlow".
