# dev (project auto launcher)

One command to detect your stack, install deps, pick a free port, and start the right dev process — in the foreground by default. Use `--tmux` to launch inside a tmux session.

## Quick start
```bash
npm install -g .

# run in any project root
dev                 # auto-detect + run (foreground, sequential)
dev --print         # show what would run (no execution)
dev --port 4000     # use a specific port
dev --tmux          # launch inside a tmux session
dev sessions        # list tmux sessions started by dev
dev kill NAME       # kill a specific dev tmux session
dev help            # usage
```
Ensure your npm global bin directory is on `PATH` (`npm bin -g`).

## What it does
- Detects frameworks/runtimes:
  - **Node**: Next.js, Vite, Nuxt, SvelteKit, Remix, Expo, generic scripts, TypeScript server fallback (`src/index.ts` via ts-node), `dist/index.js`, or `index.js/server.js`.
  - **Python**: Django, FastAPI (uvicorn), Flask, generic `app.py/main.py`.
    - If `.venv/bin/python` exists, runs with that interpreter.
    - Else uses `uv run`. If neither `.venv` nor `uv` is available, exits with an error.
  - **Go**: `go run` (main.go / cmd/server/main.go / .).
  - **Java**: Gradle `bootRun`, Maven `spring-boot:run`.
- **Package manager**: chooses pnpm > yarn > bun > npm based on lockfiles; defaults to npm when only `package.json` is present.
- **Installs deps** (best effort): `pnpm|yarn|bun|npm install`, `uv sync`, `go mod download`.
- **Port handling**: starts from a sensible default (3000 for Node, 8000 for Django/FastAPI/Flask, 8080 for Go/Java), scans for a free port, falls back to an OS-assigned port; prints the final `PORT`.
- **Output**: colorized step banners (Detection → Installing deps → Launching).

## Launch modes

| Command | Behavior |
|---|---|
| `dev` | Runs the first detected command in the foreground (default) |
| `dev --port 4000` | Forces port 4000; skips free-port scan |
| `dev --tmux` | Launches inside a new tmux session; splits panes for multi-command stacks |
| `dev sessions` | Lists all `dev-...` tmux sessions with paths, timestamps, and URLs |
| `dev kill <name>` | Kills a specific tmux session |

**Port priority:** `--port` flag > `PORT` env var > framework default (3000 / 8000 / 8080).

> **Multi-command stacks** (e.g. `dev:server` + `dev:client`): default mode runs only the first command. Use `--tmux` to run all commands in split panes.

## Requirements
- Node.js + npm (or your package manager)
- Optional: `tmux` (only needed for `--tmux` mode)
- Optional: `uv` for Python projects, `go` for Go, Java toolchain for Gradle/Maven

## Handy tmux commands (when using `--tmux`)
- Attach: `tmux attach -t <name>`
- List: `tmux ls`
- Kill: `tmux kill-session -t <name>`
- Move pane: `Ctrl-b` then arrow key
- Split: `Ctrl-b %` (vertical), `Ctrl-b "` (horizontal)

## Local (non-global) use
```bash
node dev.js           # run
node dev.js --print   # dry run
node dev.js --tmux    # tmux mode
```
or `chmod +x dev.js && ./dev.js`.

## Notes
- Dependency install failures emit warnings; the launcher still attempts to run.
- To add custom detection rules, edit `dev.js` and reinstall globally (`npm install -g .`).

## Zsh Completion

Add the completion script to your `fpath` or source it in your `.zshrc`.

**Method 1 (Recommended): Add to `fpath`**
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
