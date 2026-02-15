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

const existsAny = (names) => names.some((n) => fs.existsSync(path.join(ROOT, n)));

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

const detectPkgManager = () => {
  if (fs.existsSync(path.join(ROOT, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(ROOT, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(ROOT, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(ROOT, "package-lock.json")) || fs.existsSync(path.join(ROOT, "npm-shrinkwrap.json"))) return "npm";
  if (fs.existsSync(path.join(ROOT, "package.json"))) return "npm"; // default for Node without lockfile
  return "npm";
};

const pythonInterpreter = () => {
  const venv = path.join(ROOT, ".venv", "bin", "python");
  if (fs.existsSync(venv)) return venv;
  return "python";
};

const pythonMode = () => {
  const venvPy = path.join(ROOT, ".venv", "bin", "python");
  if (fs.existsSync(venvPy)) return { mode: "venv", python: venvPy };
  if (commandExists("uv")) return { mode: "uv", python: "python" };
  return { mode: "none", python: "python" };
};

const wrapPythonCmd = (cmdParts, mode) => {
  if (mode === "uv") return ["uv", "run", ...cmdParts];
  return cmdParts;
};

const pmScript = (sub) => {
  const pm = detectPkgManager();
  if (pm === "yarn" || pm === "bun") return [pm, sub];
  return [pm, "run", sub];
};

const requirementContains = (...needles) => {
  for (const name of ["requirements.txt", "requirements-dev.txt", "pyproject.toml", "Pipfile", "poetry.lock", "uv.lock"]) {
    const txt = readText(path.join(ROOT, name)).toLowerCase();
    if (!txt) continue;
    if (needles.some((n) => txt.includes(n.toLowerCase()))) return true;
  }
  return false;
};

const detectNodeCommand = () => {
  const pkgPath = path.join(ROOT, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  const data = loadJSON(pkgPath);
  const deps = { ...(data.dependencies || {}), ...(data.devDependencies || {}) };
  const hasDep = (n) => deps[n] !== undefined;

  if (existsAny(["next.config.js", "next.config.ts", "next.config.mjs", "next.config.cjs"]) || hasDep("next"))
    return { name: "Next.js", commands: [pmScript("dev")] };
  if (existsAny(["vite.config.js", "vite.config.ts", "vite.config.mjs"]) || hasDep("vite"))
    return { name: "Vite", commands: [pmScript("dev")] };
  if (existsAny(["nuxt.config.ts", "nuxt.config.js"]) || hasDep("nuxt"))
    return { name: "Nuxt", commands: [pmScript("dev")] };
  if (existsAny(["svelte.config.js", "svelte.config.ts"]) || hasDep("@sveltejs/kit"))
    return { name: "SvelteKit", commands: [pmScript("dev")] };
  if (existsAny(["remix.config.js", "remix.config.ts"]) || hasDep("@remix-run/dev"))
    return { name: "Remix", commands: [pmScript("dev")] };
  if (hasDep("expo")) return { name: "Expo", commands: [pmScript("start")] };

  const scripts = data.scripts || {};
  // Multi-target convention: dev:server + dev:client
  if (scripts["dev:server"] && scripts["dev:client"]) {
    return { name: "Node (server+client)", commands: [pmScript("dev:server"), pmScript("dev:client")] };
  }
  for (const candidate of ["dev", "start", "serve"]) {
    if (scripts[candidate]) return { name: "Node", commands: [pmScript(candidate)] };
  }
  // TypeScript server fallback
  if (existsAny(["tsconfig.json"]) && fs.existsSync(path.join(ROOT, "src/index.ts"))) {
    return { name: "Node", commands: [["pnpm", "exec", "ts-node", "src/index.ts"]] };
  }
  // Built JS fallback
  if (fs.existsSync(path.join(ROOT, "dist/index.js"))) {
    return { name: "Node", commands: [["node", "dist/index.js"]] };
  }
  if (existsAny(["index.js", "server.js"])) {
    return { name: "Node", commands: [["node", fs.existsSync(path.join(ROOT, "index.js")) ? "index.js" : "server.js"]] };
  }
  return null;
};

const wrapUv = (cmd) => (cmd[0] === "uv" ? cmd : ["uv", "run", ...cmd]);

const detectPythonCommand = () => {
  const env = {};
  const { mode, python } = pythonMode();
  if (fs.existsSync(path.join(ROOT, "manage.py"))) {
    const port = process.env.PORT || "8000";
    return { name: "Django", commands: [wrapPythonCmd([python, "manage.py", "runserver", port], mode)], env, pyMode: mode };
  }
  if (requirementContains("fastapi")) {
    let appPath = "main:app";
    for (const c of ["main.py", "app/main.py", "src/main.py"]) {
      if (fs.existsSync(path.join(ROOT, c))) {
        appPath = `${c.replace(".py", "").replace(/\//g, ".")}:app`;
        break;
      }
    }
    const port = process.env.PORT || "8000";
    return { name: "FastAPI", commands: [wrapPythonCmd(["uvicorn", appPath, "--reload", "--port", port], mode)], env, pyMode: mode };
  }
  if (requirementContains("flask")) {
    if (!process.env.FLASK_APP) {
      for (const c of ["app.py", "wsgi.py", "main.py"]) {
        if (fs.existsSync(path.join(ROOT, c))) {
          env.FLASK_APP = c;
          break;
        }
      }
    }
    return { name: "Flask", commands: [wrapPythonCmd([python, "-m", "flask", "run"], mode)], env, pyMode: mode };
  }
  for (const c of ["app.py", "main.py"]) {
    if (fs.existsSync(path.join(ROOT, c))) return { name: "Python", commands: [wrapPythonCmd([python, c], mode)], env, pyMode: mode };
  }
  return null;
};

const detectGoCommand = () => {
  if (!fs.existsSync(path.join(ROOT, "go.mod"))) return null;
  if (fs.existsSync(path.join(ROOT, "main.go"))) return { name: "Go", commands: [["go", "run", "main.go"]] };
  if (fs.existsSync(path.join(ROOT, "cmd/server/main.go"))) return { name: "Go", commands: [["go", "run", "cmd/server/main.go"]] };
  return { name: "Go", commands: [["go", "run", "."]] };
};

const detectJavaCommand = () => {
  if (fs.existsSync(path.join(ROOT, "gradlew")) || fs.existsSync(path.join(ROOT, "build.gradle"))) {
    const wrapper = fs.existsSync(path.join(ROOT, "gradlew")) ? "./gradlew" : "gradle";
    return { name: "Gradle", commands: [[wrapper, "bootRun"]] };
  }
  if (fs.existsSync(path.join(ROOT, "mvnw")) || fs.existsSync(path.join(ROOT, "pom.xml"))) {
    const wrapper = fs.existsSync(path.join(ROOT, "mvnw")) ? "./mvnw" : "mvn";
    return { name: "Maven", commands: [[wrapper, "spring-boot:run"]] };
  }
  return null;
};

const detect = () => {
  const checks = [
    () => {
      const r = detectNodeCommand();
      return r ? { ...r, env: {} } : null;
    },
    () => detectPythonCommand(),
    () => {
      const r = detectGoCommand();
      return r ? { ...r, env: {} } : null;
    },
    () => {
      const r = detectJavaCommand();
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

const ensureFlaskPort = (name, commands, env) => {
  if (name !== "Flask") return commands;
  if (!env.PORT) return commands;
  env.FLASK_RUN_PORT = env.PORT;
  return commands.map((cmd) => {
    if (cmd.includes("--port")) return cmd;
    return [...cmd, "--port", env.PORT];
  });
};

const installDeps = (name, pyMode) => {
  logStep("Installing dependencies");
  if (["Next.js", "Vite", "Nuxt", "SvelteKit", "Remix", "Expo", "Node"].includes(name) && fs.existsSync(path.join(ROOT, "package.json"))) {
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
    logWarn("Multiple commands detected; tmux disabled, running the first command only.");
  }
  const [cmd] = commands;
  const child = spawn(cmd[0], cmd.slice(1), { cwd: ROOT, env, stdio: "inherit" });
  child.on("exit", (code) => {
    if (code === 0) logSuccess("Process exited cleanly");
    else logFail(`Process exited with ${code}`);
    process.exit(code ?? 0);
  });
};

const listSessions = () => {
  if (!tmuxAvailable()) {
    logFail("tmux is required but not found.");
    process.exit(1);
  }
  const res = spawnSync("tmux", ["list-sessions", "-F", "#{session_name}\t#{session_created}\t#{@dev_root}\t#{session_path}"], { encoding: "utf8" });
  if (res.status !== 0) {
    logFail("Failed to list tmux sessions");
    process.exit(res.status || 1);
  }
  const lines = res.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((s) => s.startsWith("dev-"));
  if (!lines.length) {
    console.log("No dev sessions.");
    return;
  }
  const parsed = lines.map((line) => {
    const [name, created, root, sessionPath] = line.split("\t");
    const ts = Number(created) * 1000;
    const when = Number.isFinite(ts) ? new Date(ts).toLocaleString() : "unknown";
    const sourcePath = (root && root.trim()) ? root : (sessionPath || "");
    const tail = sourcePath.slice(-30);
    const pathTail = tail ? (sourcePath.length > 30 ? `..${tail}` : tail) : "unknown";
    return { name, when, pathTail };
  });
  const maxName = Math.max(...parsed.map((p) => p.name.length));
  const maxPath = Math.max(...parsed.map((p) => p.pathTail.length));
  const gap = 4;
  parsed.forEach(({ name, when, pathTail }) => {
    const padded = name.padEnd(maxName + gap, " ");
    const pathPadded = pathTail.padEnd(maxPath + gap, " ");
    const time = paint(when, "yellow");
    console.log(`${padded}${pathPadded}${time}`);
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
  if (args[0] === "help") {
    console.log(`
dev - project auto launcher (tmux required)

Usage:
  dev               # detect + install deps + run (tmux if available)
  dev --print       # show detected commands/PORT only
  dev --no-tmux     # force no tmux (run first command only)
  dev sessions      # list tmux sessions started by dev
  dev kill <name>   # kill a specific dev tmux session

Behavior:
  - Detects stack (Node/Python/Go/Java) and picks commands.
  - Installs deps (pnpm/yarn/bun/npm, uv sync, go mod download).
  - Chooses a free port near the default; falls back to OS-assigned.
  - Launches inside tmux when available; otherwise runs the first command sequentially.
  - Python: prefers .venv/bin/python; else uv run; if neither, exits.
`);
    return;
  }

  const printOnly = args.includes("--print");
  const forceNoTmux = args.includes("--no-tmux");
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

  const env = { ...process.env, ...extraEnv };

  const defaultPorts = {
    "Next.js": 3000,
    Nuxt: 3000,
    Remix: 3000,
    Expo: 3000,
    Node: 3000,
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
  if (defaultPorts[name]) {
    const desired = parseInt(env.PORT || defaultPorts[name], 10);
    const free = await pickFreePort(desired);
    if (free === null) logWarn(`Could not find a free port near ${desired}. Continuing without PORT override.`);
    else {
      if (free !== desired) logWarn(`PORT ${desired} in use. Switching to ${free}.`);
      env.PORT = String(free);
    }
  }
  const adjustedCommands = ensureFlaskPort(name, commands, env);

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

  const wantTmux = !forceNoTmux && tmuxAvailable();
  if (wantTmux) {
    logStep("Launching in tmux");
    runWithTmux(adjustedCommands, env);
    return;
  }

  if (!forceNoTmux) {
    logWarn("tmux not found; running without tmux.");
  } else {
    logStep("Launching without tmux (flag)");
  }
  runSequential(adjustedCommands, env);
};

main().catch((err) => {
  logFail(err.message);
  process.exit(1);
});
