# AI Working Rules

*Last Updated: 2026-07-18*

These rules dictate how AI agents must interact with the MediFlow codebase. Adhere strictly to these guidelines.

## Mandatory Initialization
1. **Always read the documentation:** At the beginning of any session or major feature request, you MUST read `docs/AI_CONTEXT.md`, `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md`, and this `docs/AI_RULES.md` file.
2. **Verify current repository state:** Do not assume previous context or rely on generic templates. Use file exploration tools to verify the exact names, paths, and contents of the existing repository before planning your implementation.

## General Principles
- **Analyze before implementing.** Understand the impact of your changes on the existing architecture (especially shared UI components and the workflow engine).
- **Work incrementally.** Do not attempt to implement the entire solution in a single turn. Work one approved phase at a time.
- **Always prefer modifying existing code over rewriting large sections.**
- **Large refactors or architectural changes require explicit approval before implementation.**
- **Do not modify business logic or core architecture without explicit user approval.** 
- **Keep changes minimal and maintainable.** Avoid over-engineering.
- **Reuse existing components:** Always check `client/src/components` (e.g., `DashboardLayout`, `ActionModal`) and `server/src/utils` before creating new ones.
- **Preserve coding conventions.** Follow existing patterns for `.routes.ts`, `.controller.ts`, React Hooks, and Tailwind CSS class structures.

## Development Workflow
- Prefer essential verification (`npx tsc --noEmit` and linting) during normal development to ensure type safety without the overhead of full builds.
- Run `npm run build` only when appropriate or specifically requested to verify the production bundle.
- Manual browser testing will usually be performed by the user unless explicitly requested.

## Post-Implementation Output
After each implementation step or phase, you must provide a summary containing:
1. **Files modified:** A clear list of files that were changed or created.
2. **Summary of changes:** A brief explanation of what was accomplished and how it integrates with the existing architecture.
3. **Verification performed:** What checks (e.g., `tsc`, linting) were run.
4. **Any issues encountered:** Any warnings or edge cases worth noting.

**Crucial**: Wait for the user's explicit approval before continuing to the next planned phase.
