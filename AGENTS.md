# AGENTS.md

## Cursor Cloud specific instructions

**Product:** Stundenlauf TS — a fully client-side React/TypeScript PWA for managing German "Stundenlauf" race series. No backend, no database server; all data is stored in the browser's IndexedDB.

**Runtime requirements:** Node.js v22+ LTS, pnpm 10.x (installed via Corepack; already available in the environment).

**Key commands** (all documented in `README.md` → "Available Scripts"):

| Task | Command |
|---|---|
| Install deps | `pnpm install` |
| Dev server (HMR) | `VITE_BASE_PATH="/" pnpm run dev` → http://localhost:5173 |
| Lint | `pnpm run lint` |
| Tests | `pnpm test` |
| Typecheck | `pnpm run typecheck` |
| Build | `pnpm run build` |

**Non-obvious caveats:**

- The Vite config defaults `base` to `/stundenlauf-ts/` (for GitHub Pages). When running the dev server locally, set `VITE_BASE_PATH="/"` so assets and routes resolve correctly at `http://localhost:5173/`.
- The UI is entirely in German. Season creation input is labeled "Saisonname", the create button is "Neue Saison erstellen", navigation tabs are "Saison", "Ergebnisse", "Import", "Verlauf".
- There are no external services, databases, or Docker containers. Everything runs in the browser or via Vite's dev server.
- The `@/` path alias maps to `src/` (configured in both `tsconfig.json` and `vite.config.ts`).
