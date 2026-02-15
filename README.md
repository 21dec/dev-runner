# dev (project auto launcher)

One command to detect your stack, install deps, pick a free port, and start the right dev process. Uses tmux when available; otherwise runs the first command sequentially.

## Quick start
```bash
npm install -g .

# run in any project root
dev             # auto-detect + run (tmux if available)
dev --print     # show what would run (no execution)
dev --no-tmux   # force run without tmux (first command only)
dev sessions    # list tmux sessions started by dev
dev kill NAME   # kill a specific dev tmux session
dev help        # usage
```
Ensure your npm global bin directory is on `PATH` (`npm bin -g`).

## What it does
- Detects frameworks/runtimes:
  - Node: Next.js, Vite, Nuxt, SvelteKit, Remix, Expo, generic scripts, TypeScript server fallback (`src/index.ts` via ts-node), `dist/index.js`, or `index.js/server.js`.
  - Python: Django, FastAPI (uvicorn), Flask, generic `app.py/main.py`.
    - If `.venv/bin/python` exists, runs with that interpreter (no uv).
    - Else uses `uv run`. If neither `.venv` nor `uv` is available, exits with a warning.
  - Go: `go run` (main.go / cmd/server/main.go / .).
  - Java: Gradle `bootRun`, Maven `spring-boot:run`.
- Package manager: chooses pnpm > yarn > bun > npm based on lockfiles; defaults to npm when only package.json is present.
- Installs deps (best effort): `pnpm|yarn|bun|npm install`, `uv sync`, `go mod download`.
- Port handling: starts from a sensible default (e.g., 3000 for Node, 8000 for Django/FastAPI, 8080 for Go/Java), scans for a free port, falls back to an OS-assigned port; prints the final `PORT`.
- Output: colorized step banners (Detection → Installing deps → Launching).
- tmux behavior: when available, opens a new session and tiles panes for multiple commands. `dev sessions` lists `dev-...` sessions; `dev kill <name>` terminates one. Without tmux (or with `--no-tmux`), only the first command runs.

## Requirements
- Node.js + npm (or your package manager)
- tmux (recommended for multi-command tiling; otherwise single command runs)
- Optional: `uv` for Python, `go` for Go, Java toolchain for Gradle/Maven

## Handy tmux commands
- Attach: `tmux attach -t <name>`
- List: `tmux ls`
- Kill: `tmux kill-session -t <name>`
- Move pane: `Ctrl-b` then arrow
- Split: `Ctrl-b %` (vertical), `Ctrl-b "` (horizontal)

## Local (non-global) use
```bash
node dev.js         # run
node dev.js --print # dry run
```
or `chmod +x dev.js && ./dev.js`.

## Notes
- Dependency install failures emit warnings; the launcher still attempts to run.
- To add custom detection rules, edit `dev.js` and reinstall globally (`npm install -g .`).

## Zsh Completion

Add the completion script to your `fpath` or source it in your `.zshrc`.

Method 1 (Recommended): Add to `fpath`
```zsh
# Create a directory for completions if it doesn't exist
mkdir -p ~/.zsh/completions

# Add it to your fpath in .zshrc
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -Uz compinit && compinit' >> ~/.zshrc

# Generate the completion script
dev completion > ~/.zsh/completions/_dev

# Reload shell
exec zsh
```
