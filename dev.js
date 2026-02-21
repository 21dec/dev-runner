#!/usr/bin/env node
/**
 * Project launcher (Node version)
 * - Detects framework/language
 * - Installs deps (pnpm/uv/go)
 * - Avoids port conflicts
 * - Runs the dev command with colorful, app-like logging
 *
 * Usage: node dev.js [--print]
 */

const fs = require("fs");
const path = require("path");
const { spawnSync, spawn } = require("child_process");
const net = require("net");

const ROOT = process.cwd(); // work in the directory where the user runs dev-runner
const USE_COLOR = process.stderr.isTTY;
const COLORS = {
  blue: "\u001b[38;5;39m",
  green: "\u001b[38;5;40m",
  yellow: "\u001b[38;5;214m",
  red: "\u001b[38;5;196m",
  reset: "\u001b[0m",
};

const paint = (text, color) => (USE_COLOR ? `${COLORS[color] || ""}${text}${COLORS.reset}` : text);
const logStep = (msg) => console.log(paint(`➜ ${msg}`, "blue"));
const logWarn = (msg) => console.log(paint(`⚠ ${msg}`, "yellow"));
const logSuccess = (msg) => console.log(paint(`✓ ${msg}`, "green"));
const logFail = (msg) => console.log(paint(`✖ ${msg}`, "red"));

const existsAny = (names, root = ROOT) => names.some((n) => fs.existsSync(path.join(root, n)));

const readText = (p) => {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
};

const loadJSON = (p) => {
  try {
    return JSON.parse(readText(p));
  } catch {
    return {};
  }
};

const commandExists = (cmd, args = ["-V"]) => spawnSync(cmd, args, { stdio: "ignore" }).status === 0;
const tmuxAvailable = () => commandExists("tmux", ["-V"]);

const detectPkgManager = (root = ROOT) => {
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(root, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(root, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(root, "package-lock.json")) || fs.existsSync(path.join(root, "npm-shrinkwrap.json"))) return "npm";
  if (fs.existsSync(path.join(root, "package.json"))) return "npm"; // default for Node without lockfile
  return "npm";
};



const pythonMode = (root = ROOT) => {
  const venvPy = path.join(root, ".venv", "bin", "python");
  if (fs.existsSync(venvPy)) return { mode: "venv", python: venvPy };
  if (commandExists("uv")) return { mode: "uv", python: "python" };
  return { mode: "none", python: "python" };
};

const wrapPythonCmd = (cmdParts, mode) => {
  if (mode === "uv") return ["uv", "run", ...cmdParts];
  return cmdParts;
};

const pmScript = (sub, root = ROOT) => {
  const pm = detectPkgManager(root);
  if (pm === "yarn" || pm === "bun") return [pm, sub];
  return [pm, "run", sub];
};

const requirementContains = (root = ROOT, ...needles) => {
  for (const name of ["requirements.txt", "requirements-dev.txt", "pyproject.toml", "Pipfile", "poetry.lock", "uv.lock"]) {
    const txt = readText(path.join(root, name)).toLowerCase();
    if (!txt) continue;
    if (needles.some((n) => txt.includes(n.toLowerCase()))) return true;
  }
  return false;
};

const detectNodeCommand = (root = ROOT) => {
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  const data = loadJSON(pkgPath);
  const deps = { ...(data.dependencies || {}), ...(data.devDependencies || {}) };
  const hasDep = (n) => deps[n] !== undefined;

  if (existsAny(["next.config.js", "next.config.ts", "next.config.mjs", "next.config.cjs"], root) || hasDep("next"))
    return { name: "Next.js", commands: [pmScript("dev", root)] };
  if (existsAny(["vite.config.js", "vite.config.ts", "vite.config.mjs"], root) || hasDep("vite"))
    return { name: "Vite", commands: [pmScript("dev", root)] };
  if (existsAny(["nuxt.config.ts", "nuxt.config.js"], root) || hasDep("nuxt"))
    return { name: "Nuxt", commands: [pmScript("dev", root)] };
  if (existsAny(["svelte.config.js", "svelte.config.ts"], root) || hasDep("@sveltejs/kit"))
    return { name: "SvelteKit", commands: [pmScript("dev", root)] };
  if (existsAny(["remix.config.js", "remix.config.ts"], root) || hasDep("@remix-run/dev"))
    return { name: "Remix", commands: [pmScript("dev", root)] };
  if (hasDep("expo")) return { name: "Expo", commands: [pmScript("start", root)] };

  const scripts = data.scripts || {};
  // Multi-target convention: dev:server + dev:client
  if (scripts["dev:server"] && scripts["dev:client"]) {
    return { name: "Node (server+client)", commands: [pmScript("dev:server", root), pmScript("dev:client", root)] };
  }
  for (const candidate of ["dev", "start", "serve"]) {
    if (scripts[candidate]) return { name: "Node", commands: [pmScript(candidate, root)] };
  }
  // TypeScript server fallback
  if (existsAny(["tsconfig.json"], root) && fs.existsSync(path.join(root, "src/index.ts"))) {
    return { name: "Node", commands: [["pnpm", "exec", "ts-node", "src/index.ts"]] };
  }
  // Built JS fallback
  if (fs.existsSync(path.join(root, "dist/index.js"))) {
    return { name: "Node", commands: [["node", "dist/index.js"]] };
  }
  if (existsAny(["index.js", "server.js"], root)) {
    return { name: "Node", commands: [["node", fs.existsSync(path.join(root, "index.js")) ? "index.js" : "server.js"]] };
  }
  return null;
};



const detectPythonCommand = (root = ROOT) => {
  const env = {};
  const { mode, python } = pythonMode(root);
  if (fs.existsSync(path.join(root, "manage.py"))) {
    // Port is injected later by applyPort(); use placeholder for now
    return { name: "Django", commands: [wrapPythonCmd([python, "manage.py", "runserver", "PORT_PLACEHOLDER"], mode)], env, pyMode: mode };
  }
  if (requirementContains(root, "fastapi")) {
    let appPath = "main:app";
    for (const c of ["main.py", "app/main.py", "src/main.py"]) {
      if (fs.existsSync(path.join(root, c))) {
        appPath = `${c.replace(".py", "").replace(/\//g, ".")}:app`;
        break;
      }
    }
    // Port is injected later by applyPort(); use placeholder for now
    return { name: "FastAPI", commands: [wrapPythonCmd(["uvicorn", appPath, "--reload", "--port", "PORT_PLACEHOLDER"], mode)], env, pyMode: mode };
  }
  if (requirementContains(root, "flask")) {
    if (!process.env.FLASK_APP) {
      for (const c of ["app.py", "wsgi.py", "main.py"]) {
        if (fs.existsSync(path.join(root, c))) {
          env.FLASK_APP = c;
          break;
        }
      }
    }
    return { name: "Flask", commands: [wrapPythonCmd([python, "-m", "flask", "run"], mode)], env, pyMode: mode };
  }
  for (const c of ["app.py", "main.py"]) {
    if (fs.existsSync(path.join(root, c))) return { name: "Python", commands: [wrapPythonCmd([python, c], mode)], env, pyMode: mode };
  }
  return null;
};

const detectGoCommand = (root = ROOT) => {
  if (!fs.existsSync(path.join(root, "go.mod"))) return null;
  if (fs.existsSync(path.join(root, "main.go"))) return { name: "Go", commands: [["go", "run", "main.go"]] };
  if (fs.existsSync(path.join(root, "cmd/server/main.go"))) return { name: "Go", commands: [["go", "run", "cmd/server/main.go"]] };
  return { name: "Go", commands: [["go", "run", "."]] };
};

const detectJavaCommand = (root = ROOT) => {
  if (fs.existsSync(path.join(root, "gradlew")) || fs.existsSync(path.join(root, "build.gradle"))) {
    const wrapper = fs.existsSync(path.join(root, "gradlew")) ? "./gradlew" : "gradle";
    return { name: "Gradle", commands: [[wrapper, "bootRun"]] };
  }
  if (fs.existsSync(path.join(root, "mvnw")) || fs.existsSync(path.join(root, "pom.xml"))) {
    const wrapper = fs.existsSync(path.join(root, "mvnw")) ? "./mvnw" : "mvn";
    return { name: "Maven", commands: [[wrapper, "spring-boot:run"]] };
  }
  return null;
};

const detect = (root = ROOT) => {
  const checks = [
    () => {
      const r = detectNodeCommand(root);
      return r ? { ...r, env: {} } : null;
    },
    () => detectPythonCommand(root),
    () => {
      const r = detectGoCommand(root);
      return r ? { ...r, env: {} } : null;
    },
    () => {
      const r = detectJavaCommand(root);
      return r ? { ...r, env: {} } : null;
    },
  ];
  for (const checker of checks) {
    const res = checker();
    if (res) return res;
  }
  return { name: "Unknown", commands: [], env: {} };
};

const pickFreePort = (start, attempts = 200) =>
  new Promise((resolve) => {
    const tryPort = (port, remaining) => {
      const server = net.createServer();
      server.once("error", () => {
        server.close();
        if (remaining <= 0) {
          // Last resort: ask OS for any free port (port 0)
          const fallback = net.createServer();
          fallback.listen(0, () => {
            const assigned = fallback.address().port;
            fallback.close(() => resolve(assigned));
          });
          fallback.on("error", () => resolve(null));
          return;
        }
        tryPort(port + 1, remaining - 1);
      });
      server.listen(port, () => {
        server.close(() => resolve(port));
      });
    };
    tryPort(start, attempts);
  });

/**
 * Apply the resolved port to commands/env in a framework-aware way:
 *  - Django  : replace PORT_PLACEHOLDER arg
 *  - FastAPI : replace --port PORT_PLACEHOLDER arg
 *  - Flask   : add --port arg + set FLASK_RUN_PORT
 *  - Spring  : set SERVER_PORT env var
 *  - Others  : PORT env var is already set; nothing extra needed
 */
const applyPort = (name, commands, env) => {
  const port = env.PORT || String(defaultPorts[name] || "");
  if (!port) return commands;

  if (name === "Django") {
    return commands.map((cmd) =>
      cmd.map((arg) => (arg === "PORT_PLACEHOLDER" ? port : arg))
    );
  }

  if (name === "FastAPI") {
    return commands.map((cmd) => {
      const idx = cmd.indexOf("PORT_PLACEHOLDER");
      if (idx !== -1) {
        const next = [...cmd];
        next[idx] = port;
        return next;
      }
      return cmd;
    });
  }

  if (name === "Flask") {
    env.FLASK_RUN_PORT = port;
    return commands.map((cmd) => {
      if (cmd.includes("--port")) return cmd;
      return [...cmd, "--port", port];
    });
  }

  if (name === "Vite" || name === "SvelteKit") {
    return commands.map((cmd) => {
      if (cmd.includes("--port")) return cmd;
      // Pass --port through npm/pnpm/yarn script via `--`
      return [...cmd, "--", "--port", port];
    });
  }

  if (name === "Gradle" || name === "Maven") {
    env.SERVER_PORT = port; // Spring Boot reads SERVER_PORT
    return commands;
  }

  return commands; // Node/Go/etc: PORT env var is sufficient
};

const installDeps = (name, pyMode) => {
  logStep("Installing dependencies");
  if (["Next.js", "Vite", "Nuxt", "SvelteKit", "Remix", "Expo", "Node", "Node (server+client)"].includes(name) && fs.existsSync(path.join(ROOT, "package.json"))) {
    const pm = detectPkgManager();
    const installCmd =
      pm === "yarn"
        ? ["yarn", "install"]
        : pm === "bun"
          ? ["bun", "install"]
          : pm === "pnpm"
            ? ["pnpm", "install"]
            : ["npm", "install"];
    const result = spawnSync(installCmd[0], installCmd.slice(1), { cwd: ROOT, stdio: "inherit" });
    if (result.status === 0) logSuccess(`${pm} install complete`);
    else logWarn(`${pm} install exited with ${result.status} (continuing)`);
    return;
  }
  if (["Django", "FastAPI", "Flask", "Python"].includes(name)) {
    if (pyMode === "venv") {
      logWarn("Using existing .venv; skipping auto-install (run pip/uv inside venv if needed).");
      return;
    }
    if (pyMode === "none") {
      logFail("No .venv and uv not found. Please create a venv or install uv.");
      process.exit(1);
    }
    const manifests = ["pyproject.toml", "uv.lock", "requirements.txt", "requirements-dev.txt", "Pipfile", "poetry.lock"];
    if (manifests.some((f) => fs.existsSync(path.join(ROOT, f)))) {
      const result = spawnSync("uv", ["sync"], { cwd: ROOT, stdio: "inherit" });
      if (result.status === 0) logSuccess("uv sync complete");
      else logWarn(`uv sync exited with ${result.status} (continuing)`);
      return;
    }
  }
  if (name === "Go" && fs.existsSync(path.join(ROOT, "go.mod"))) {
    const result = spawnSync("go", ["mod", "download"], { cwd: ROOT, stdio: "inherit" });
    if (result.status === 0) logSuccess("go mod download complete");
    else logWarn(`go mod download exited with ${result.status} (continuing)`);
    return;
  }
  logWarn("No dependency step needed");
};

const shEsc = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

const makeSessionName = () => {
  const slug = path.basename(ROOT).replace(/[^a-zA-Z0-9_-]/g, "-") || "project";
  return `dev-${slug}-${Date.now().toString(36).slice(-4)}`;
};


const commandString = (cmd, env) => {
  const envExpr = Object.entries(env || {})
    .map(([k, v]) => `${k}=${shEsc(v)}`)
    .join(" ");
  const prefix = envExpr ? `env ${envExpr} ` : "";
  return `cd ${shEsc(ROOT)} && ${prefix}${cmd.map(shEsc).join(" ")}`;
};

const runWithTmux = (commands, env) => {
  const session = makeSessionName();
  const first = commands[0];
  let res = spawnSync("tmux", ["new-session", "-d", "-s", session, commandString(first, env)], { stdio: "inherit" });
  if (res.status !== 0) {
    logFail("Failed to create tmux session");
    process.exit(res.status || 1);
  }
  spawnSync("tmux", ["set-session", "-t", session, "@dev_root", ROOT], { stdio: "ignore" });
  if (env.PORT) {
    spawnSync("tmux", ["set-session", "-t", session, "@dev_port", env.PORT], { stdio: "ignore" });
  }

  for (let i = 1; i < commands.length; i++) {
    const cmd = commands[i];
    res = spawnSync("tmux", ["split-window", "-v", "-t", session, commandString(cmd, env)], { stdio: "inherit" });
    if (res.status !== 0) {
      logFail("Failed to add pane in tmux");
      process.exit(res.status || 1);
    }
  }
  spawnSync("tmux", ["select-layout", "-t", session, "tiled"], { stdio: "ignore" });
  logSuccess(`tmux session ready: ${session}`);
  logStep(`Attach with: tmux attach -t ${session}`);
};

const runSequential = (commands, env) => {
  if (commands.length > 1) {
    logWarn("Multiple commands detected; running the first command only. Use --tmux to run all.")
  }
  const [cmd] = commands;
  const child = spawn(cmd[0], cmd.slice(1), { cwd: ROOT, env, stdio: "inherit" });
  child.on("exit", (code) => {
    if (code === 0) logSuccess("Process exited cleanly");
    else logFail(`Process exited with ${code}`);
    process.exit(code ?? 0);
  });
};

const getTreePids = (rootPid) => {
  let pids = [rootPid];
  try {
    const res = spawnSync("pgrep", ["-P", rootPid], { encoding: "utf8" });
    if (res.status === 0) {
      const children = res.stdout.trim().split(/\s+/);
      for (const child of children) {
        if (child) pids = pids.concat(getTreePids(child));
      }
    }
  } catch (e) { }
  return pids;
};

const findListeningPort = (pids) => {
  if (!pids.length) return null;
  try {
    const args = ["-a", "-iTCP", "-sTCP:LISTEN", "-n", "-P", "-F", "n", "-p", pids.join(",")];
    const res = spawnSync("lsof", args, { encoding: "utf8" });
    if (res.status !== 0) return null;
    const lines = res.stdout.trim().split("\n");
    for (const line of lines) {
      if (line.startsWith("n")) {
        const parts = line.substring(1).split(":");
        const port = parts[parts.length - 1];
        if (port && !isNaN(port)) return port;
      }
    }
  } catch (e) { }
  return null;
};

const listSessions = () => {
  if (!tmuxAvailable()) {
    logFail("tmux is required but not found.");
    process.exit(1);
  }
  const res = spawnSync("tmux", ["list-sessions", "-F", "#{session_name}\t#{session_created}\t#{@dev_root}\t#{session_path}\t#{@dev_port}"], { encoding: "utf8" });
  if (res.status !== 0) return;
  const lines = res.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((s) => s.startsWith("dev-"));
  if (!lines.length) {
    logWarn("No active dev sessions.");
    return;
  }

  const parsed = lines.map((line) => {
    const [name, created, root, sessionPath, port] = line.split("\t");
    const ts = Number(created) * 1000;
    const when = Number.isFinite(ts) ? new Date(ts).toLocaleString() : "unknown";
    const sourcePath = (root && root.trim()) ? root : (sessionPath || "");
    const tailSource = sourcePath.slice(-30);
    const pathTail = tailSource ? (sourcePath.length > 30 ? `..${tailSource}` : tailSource) : "unknown";

    let url = "";

    let detectedPort = null;
    try {
      // Find tmux pane PID for this session
      const paneRes = spawnSync("tmux", ["list-panes", "-t", name, "-F", "#{pane_pid}"], { encoding: "utf8" });
      if (paneRes.status === 0) {
        const panePids = paneRes.stdout.trim().split("\n").filter(Boolean);
        let allPids = [];
        for (const pp of panePids) {
          const clean = pp.replace(/[^0-9]/g, "");
          if (clean) allPids = allPids.concat(getTreePids(clean));
        }
        detectedPort = findListeningPort(allPids);
      }
    } catch (e) { }

    if (detectedPort) {
      url = `http://localhost:${detectedPort}`;
    } else if (port && port.trim()) {
      url = `http://localhost:${port.trim()} (saved)`;
    }

    return { name, when, pathTail, url };
  });

  const maxName = Math.max(...parsed.map((p) => p.name.length));
  const maxPath = Math.max(...parsed.map((p) => p.pathTail.length));
  const gap = 4;

  parsed.forEach(({ name, when, pathTail, url }) => {
    const paddedName = name.padEnd(maxName + gap, " ");
    const paddedPath = pathTail.padEnd(maxPath + gap, " ");
    const time = paint(when, "yellow");
    const urlStr = url ? paint(`  ${url}`, "blue") : "";
    console.log(`${paddedName}${paddedPath}${time}${urlStr}`);
  });
};

const killSession = (name) => {
  if (!tmuxAvailable()) {
    logFail("tmux is required but not found.");
    process.exit(1);
  }
  const res = spawnSync("tmux", ["kill-session", "-t", name], { stdio: "inherit" });
  if (res.status === 0) logSuccess(`Killed session ${name}`);
  else process.exit(res.status || 1);
};

const defaultPorts = {
  "Next.js": 3000,
  Nuxt: 3000,
  Remix: 3000,
  Expo: 3000,
  Node: 3000,
  "Node (server+client)": 3000,
  Vite: 5173,
  SvelteKit: 5173,
  Django: 8000,
  FastAPI: 8000,
  Flask: 8000,
  Python: 8000,
  Go: 8080,
  Gradle: 8080,
  Maven: 8080,
};

const main = async () => {
  const args = process.argv.slice(2);
  if (args[0] === "sessions") return listSessions();
  if (args[0] === "kill") {
    const target = args[1];
    if (!target) {
      logFail("Usage: dev kill <session>");
      process.exit(1);
    }
    return killSession(target);
  }
  if (args[0] === "ui") {
    try {
      const electron = require("electron");
      const cp = require("child_process");
      const mainPath = path.join(__dirname, "main.js");
      cp.spawn(electron, [mainPath], { stdio: "inherit", detached: true }).unref();
    } catch {
      // Fallback: run web server directly
      require("./web/server.js");
    }
    return;
  }
  if (args[0] === "completion") {
    console.log(`#compdef dev

local curcontext="$curcontext" state line
typeset -A opt_args

_arguments -C \\
    '--print[Show detected commands and port only]' \\
    '--tmux[Launch inside tmux session]' \\
    '--port[Specify port number]:port number:' \\
    '*--env[Set environment variable]:env var (KEY=VALUE):' \\
    '1: :->cmds' \\
    '*:: :->args'

case $state in
    cmds)
        # If the first argument is already a flag, we typically don't offer subcommands
        if [[ $line[1] == --* ]]; then
            return 0
        fi

        local -a commands
        commands=(
            'sessions:List tmux sessions started by dev'
            'kill:Kill a specific dev tmux session'
            'completion:Generate zsh completion script'
            'help:Show help message'
        )
        _describe -t commands 'dev command' commands
        ;;
    args)
        case $line[1] in
            kill)
                local -a sessions
                # List tmux sessions starting with 'dev-'
                if command -v tmux >/dev/null; then
                    sessions=($(tmux list-sessions -F "#{session_name}" 2>/dev/null | grep "^dev-"))
                fi
                if (( \${#sessions} )); then
                    _describe -t sessions 'session' sessions
                else
                    _message 'no dev sessions found'
                fi
                ;;
        esac
        ;;
esac`);
    return;
  }
  if (args[0] === "help") {
    console.log(`
dev - project auto launcher

Usage:
  dev                    # detect + install deps + run (sequential, foreground)
  dev --print            # show detected commands/PORT only
  dev --port <number>    # use a specific port
  dev --env KEY=VALUE    # set env var (repeatable, e.g. --env VITE_API_PORT=4000)
  dev --tmux             # launch inside a tmux session
  dev sessions           # list tmux sessions started by dev
  dev kill <name>        # kill a specific dev tmux session
  dev completion         # generate zsh completion script
  dev help               # usage

Port priority:
  --port flag > PORT env var > framework default

Behavior:
  - Detects stack (Node/Python/Go/Java) and picks commands.
  - Installs deps (pnpm/yarn/bun/npm, uv sync, go mod download).
  - Chooses a free port near the default; falls back to OS-assigned.
  - --port skips the free-port scan and uses the given port directly.
  - Runs the first command sequentially by default (foreground).
  - Use --tmux to launch inside tmux (multiple commands run in split panes).
  - Python: prefers .venv/bin/python; else uv run; if neither, exits.
`);
    return;
  }

  const printOnly = args.includes("--print");
  const useTmux = args.includes("--tmux");
  const portFlagIdx = args.indexOf("--port");
  const portFlag = portFlagIdx !== -1 ? args[portFlagIdx + 1] : null;
  if (portFlag !== null && (isNaN(portFlag) || !portFlag)) {
    logFail("--port requires a valid port number (e.g. dev --port 4000)");
    process.exit(1);
  }

  // Parse --env KEY=VALUE flags (repeatable)
  const userEnvOverrides = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--env" && args[i + 1]) {
      const pair = args[i + 1];
      const eqIdx = pair.indexOf("=");
      if (eqIdx <= 0) {
        logFail(`--env requires KEY=VALUE format (got: ${pair})`);
        process.exit(1);
      }
      userEnvOverrides[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
      i++; // skip value
    }
  }

  const { name, commands, env: extraEnv, pyMode: detectedPyMode } = detect();
  if (!commands.length) {
    logFail("No framework detected. Please add a rule.");
    process.exit(1);
  }

  const pyNames = new Set(["Django", "FastAPI", "Flask", "Python"]);
  const pyMode = detectedPyMode || (pyNames.has(name) ? pythonMode().mode : undefined);
  if (pyNames.has(name) && pyMode === "none") {
    logFail("Python project detected but no .venv and no uv in PATH. Please create .venv or install uv.");
    process.exit(1);
  }

  const env = { ...process.env, ...extraEnv, ...userEnvOverrides };

  if (portFlag) {
    // --port takes highest priority; skip free-port scan
    env.PORT = portFlag;
  } else if (defaultPorts[name]) {
    const desired = parseInt(env.PORT || defaultPorts[name], 10);
    const free = await pickFreePort(desired);
    if (free === null) logWarn(`Could not find a free port near ${desired}. Continuing without PORT override.`);
    else {
      if (free !== desired) logWarn(`PORT ${desired} in use. Switching to ${free}.`);
      env.PORT = String(free);
    }
  }
  const adjustedCommands = applyPort(name, commands, env);

  logStep("Detection");
  console.log(`  Framework : ${name}`);
  if (adjustedCommands.length === 1) {
    console.log(`  Command   : ${adjustedCommands[0].join(" ")}`);
  } else {
    adjustedCommands.forEach((c, idx) => console.log(`  Command ${idx + 1}: ${c.join(" ")}`));
  }
  if (env.PORT) console.log(`  PORT      : ${env.PORT}`);

  if (printOnly) return;

  installDeps(name, pyMode);

  if (useTmux) {
    if (!tmuxAvailable()) {
      logFail("--tmux requested but tmux is not found in PATH.");
      process.exit(1);
    }
    logStep("Launching in tmux");
    // Only pass overridden env vars to tmux (it inherits the rest from parent)
    const tmuxEnv = {};
    for (const [k, v] of Object.entries(env)) {
      if (process.env[k] !== v) tmuxEnv[k] = v;
    }
    runWithTmux(adjustedCommands, tmuxEnv);
    return;
  }

  logStep("Launching");
  runSequential(adjustedCommands, env);
};

main().catch((err) => {
  logFail(err.message);
  process.exit(1);
});
