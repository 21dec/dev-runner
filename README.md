# dev (project auto launcher)

One command to detect your stack, install deps, pick a free port, and start the right dev process.

## Quick start
```bash
# install globally from this repo
npm install -g .

# run in any project root (tmux required)
dev            # auto-detect + run inside tmux
dev --print    # show what would run (no execution)
dev sessions   # list tmux sessions started by dev
dev kill NAME  # kill a specific dev tmux session
```
`npm`’s global bin folder must be on your `PATH` (often `~/.npm-global/bin` or the nvm-managed path).

## What it does
- Detects frameworks & runtimes from project files:
  - Node: Next.js, Vite, Nuxt, SvelteKit, Remix, Expo, generic scripts, TypeScript server fallback (`src/index.ts` via ts-node), built `dist/index.js`, or `index.js/server.js`.
- Python: Django, FastAPI (uvicorn), Flask, generic `app.py/main.py`.
  - If `.venv/bin/python` exists, commands run with that interpreter (no uv).
  - Otherwise uses `uv run`. If neither `.venv` nor `uv` is available, the launcher stops with a warning.
  - Go: `go run` (main.go / cmd/server/main.go / .).
  - Java: Gradle `bootRun`, Maven `spring-boot:run`.
- Installs deps before launch (best effort): `pnpm|yarn|bun|npm install`, `uv sync`, `go mod download`.
- Resolves port conflicts: starts from a sensible default (e.g., 3000 for Node, 8000 for Django/FastAPI, 8080 for Go/Java), scans for the first free port, and as a last resort asks the OS for any free port; prints the final `PORT`.
- Runs inside tmux always; multi-command projects open tiled panes. `dev sessions` lists all `dev-...` tmux sessions; `dev kill <name>` terminates one.
- Friendly output: step banners for detection → install → launch, with color/emoji.

## Detection rules (Node)
- Lockfiles decide the package manager (pnpm > yarn > bun > npm). If only `package.json` exists, default is npm.
- Prefers framework-specific configs; otherwise uses scripts `dev|start|serve`.
- If both `dev:server` and `dev:client` scripts exist, they are listed, but only the first runs (tmux support was removed).
- TypeScript server fallback: `tsconfig.json` + `src/index.ts` → `pnpm exec ts-node src/index.ts`.
- Build fallback: `dist/index.js` → `node dist/index.js`.

## Print-only mode
`dev --print` shows detected framework, command(s), and chosen `PORT` without running anything. Useful in CI or to confirm detection.

## Requirements
- Node.js + npm (or your chosen manager). For a fresh setup you can also run: `./install_node_npm.sh` (nvm + latest LTS).
- Optional: `uv` if you run Python projects; `go` for Go projects; Java toolchain for Gradle/Maven projects.

## Local (non-global) use
```bash
node dev.js         # run
node dev.js --print # dry run
```
or make it executable: `chmod +x dev.js && ./dev.js`.

## Notes
- Dependency install failures are warnings; the launcher still attempts to run.
- If you need custom rules, add more heuristics in `dev.js` and reinstall globally (`npm install -g .`).
