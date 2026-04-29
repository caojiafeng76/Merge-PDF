# AGENTS.md

## AI Development Workflow

### Before Starting Any Task
1. **Think first** — Use `sequential-thinking` tool to analyze the task and plan approach
2. **Search with Serena** — Use `serena_*` tools to find relevant symbols and understand codebase structure
3. **Read before write** — Always read relevant files first to understand context and conventions
4. **Check existing patterns** — Look at neighboring files for naming, imports, and style conventions
5. **Verify dependencies** — Check `package.json` before assuming a library exists

### Task Execution Flow
```
1. Load Skills → Check and load relevant skills and MCP tools
2. Understand → Read related code and configs
3. Plan → Identify files to modify and changes needed
4. Implement → Make minimal, focused changes
5. Verify → Run lint and typecheck
6. Report → Summarize what was done
```

### Code Modification Rules
- **Minimal changes** — Only modify what's necessary for the task
- **Preserve style** — Match existing code formatting and conventions
- **No dead code** — Remove unused imports/variables (TypeScript enforces this)
- **Type safety** — Use `import type` for type-only imports (`verbatimModuleSyntax`)

### Verification Checklist
Run these after any code change:
```bash
npm run lint      # Fix lint errors first
npm run build     # Runs tsc -b && vite build (catches type errors)
```

### Do NOT
- Add comments unless explicitly asked
- Refactor unrelated code
- Skip lint/typecheck verification
- Assume libraries exist without checking package.json

---

## Project Overview

Vite + React 19 + TypeScript starter template for a "Merge PDF" app. Currently scaffolded with default Vite template code in `src/App.tsx`.

## Tech Stack

- **Build**: Vite 8 with `@vitejs/plugin-react` (Oxc-based, not SWC)
- **Language**: TypeScript 6 (`tsconfig.app.json` for app, `tsconfig.node.json` for config files)
- **Module**: ESM (`"type": "module"` in package.json)
- **Lint**: ESLint 10 flat config with `typescript-eslint`, `react-hooks`, `react-refresh`

## Commands

```bash
bun run dev       # Dev server with HMR
bun run build     # tsc -b && vite build
bun run lint      # ESLint (no --fix by default)
bun run preview   # Preview production build
```

No test runner is configured. No formatter is configured (no Prettier).

## Key Config Facts

- `tsconfig.json` uses project references: `tsconfig.app.json` (src/) and `tsconfig.node.json` (config files). Build runs via `tsc -b`.
- `verbatimModuleSyntax` is enabled in tsconfig.app.json — imports must use `type` keyword for type-only imports (e.g., `import type { Foo } from '...'`).
- `noUnusedLocals` and `noUnusedParameters` are enabled — unused variables/params will cause type errors.
- ESLint only targets `**/*.{ts,tsx}` files.
- `dist/` is gitignored and ESLint-ignored.

## Structure

```
src/
  main.tsx      # Entry point, renders <App /> into #root
  App.tsx       # Main component (currently default Vite template)
  App.css       # Component styles
  index.css     # Global styles
  assets/       # Static assets (react.svg, vite.svg, hero.png)
public/         # Served as-is (favicon.svg, icons.svg)
```
