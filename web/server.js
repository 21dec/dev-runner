#!/usr/bin/env node
/**
 * dev-runner Web UI Server
 * Express-based API server for managing applications and port assignments.
 * Spawns/kills processes when apps are assigned/unassigned to ports via drag & drop.
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn, spawnSync } = require("child_process");

// Import detection logic from dev.js
const devLogic = require("../dev.js");

const app = express();
const UI_PORT = parseInt(process.argv[2] || process.env.UI_PORT || "4444", 10);
const CONFIG_PATH = process.env.DEV_RUNNER_CONFIG_PATH || path.join(__dirname, "apps.json");

// --- State ---
let config = loadConfig();
// Clear stale assignments on startup (processes don't survive restart)
if (Object.keys(config.assignments).length > 0) {
    config.assignments = {};
    saveConfig();
}
const runningProcesses = {}; // { "port": { process, appId, logs[] } }
const sseClients = [];

// --- Helpers ---
function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch {
        return { apps: [], ports: { frontend: [], backend: [] }, assignments: {} };
    }
}

function saveConfig() {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

function broadcastSSE(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach((res) => {
        try { res.write(msg); } catch { /* client gone */ }
    });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getState() {
    // Build current state: apps, ports with their assignment status
    const assignments = {};
    for (const [port, appId] of Object.entries(config.assignments)) {
        const proc = runningProcesses[port];
        assignments[port] = {
            appId,
            status: proc ? "running" : "assigned",
            app: config.apps.find((a) => a.id === appId) || null,
        };
    }
    return {
        apps: config.apps,
        ports: config.ports,
        assignments,
    };
}

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend", "dist")));

// --- API Routes ---

// Full state
app.get("/api/state", (_req, res) => {
    res.json(getState());
});

// Apps CRUD
app.get("/api/apps", (_req, res) => {
    res.json(config.apps);
});

app.post("/api/apps", (req, res) => {
    const { name, type, icon, command, cwd, env, framework } = req.body;
    if (!name || !command) return res.status(400).json({ error: "name and command are required" });
    const newApp = { id: generateId(), name, type: type || "Service", icon: icon || "box", command, cwd: cwd || "", env: env || {}, framework: framework || "" };
    config.apps.push(newApp);
    saveConfig();
    broadcastSSE("state", getState());
    res.status(201).json(newApp);
});

app.put("/api/apps/:id", (req, res) => {
    const { id } = req.params;
    const idx = config.apps.findIndex((a) => a.id === id);
    if (idx === -1) return res.status(404).json({ error: "app not found" });
    const { name, type, icon, command, cwd, env, framework } = req.body;
    config.apps[idx] = {
        ...config.apps[idx],
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(icon !== undefined && { icon }),
        ...(command !== undefined && { command }),
        ...(cwd !== undefined && { cwd }),
        ...(env !== undefined && { env }),
        ...(framework !== undefined && { framework }),
    };
    saveConfig();
    broadcastSSE("state", getState());
    res.json(config.apps[idx]);
});

app.delete("/api/apps/:id", (req, res) => {
    const { id } = req.params;
    // Unassign from any port first
    for (const [port, appId] of Object.entries(config.assignments)) {
        if (appId === id) {
            killProcess(port);
            delete config.assignments[port];
        }
    }
    config.apps = config.apps.filter((a) => a.id !== id);
    saveConfig();
    broadcastSSE("state", getState());
    res.json({ ok: true });
});

// Ports CRUD
app.post("/api/ports", (req, res) => {
    const { port, category } = req.body;
    const portNum = parseInt(port, 10);
    if (!portNum || !category) return res.status(400).json({ error: "port and category required" });
    if (!config.ports[category]) config.ports[category] = [];
    if (config.ports[category].includes(portNum)) return res.status(409).json({ error: "port already exists" });
    config.ports[category].push(portNum);
    config.ports[category].sort((a, b) => a - b);
    saveConfig();
    broadcastSSE("state", getState());
    res.status(201).json({ ok: true });
});

app.delete("/api/ports/:port", (req, res) => {
    const portNum = parseInt(req.params.port, 10);
    // Kill process if running on this port
    killProcess(String(portNum));
    delete config.assignments[String(portNum)];
    for (const cat of Object.keys(config.ports)) {
        config.ports[cat] = config.ports[cat].filter((p) => p !== portNum);
    }
    saveConfig();
    broadcastSSE("state", getState());
    res.json({ ok: true });
});

// Assign app to port (start process)
app.post("/api/assign", (req, res) => {
    const { appId, port } = req.body;
    const portStr = String(port);
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return res.status(404).json({ error: "app not found" });

    // If port already has a running process, kill it first
    if (runningProcesses[portStr]) {
        killProcess(portStr);
    }

    // Start the process with app-defined env vars
    const env = { ...process.env, ...(appDef.env || {}), PORT: portStr };
    const cwd = appDef.cwd || process.cwd();
    let command = appDef.command;

    // Framework-aware port injection (mirrors dev.js applyPort logic)
    const hasViteConfig = ["vite.config.js", "vite.config.ts", "vite.config.mjs"]
        .some((f) => fs.existsSync(path.join(cwd, f)));
    const hasSvelteConfig = ["svelte.config.js", "svelte.config.ts"]
        .some((f) => fs.existsSync(path.join(cwd, f)));

    if ((hasViteConfig || hasSvelteConfig) && !command.includes("--port")) {
        // Vite/SvelteKit need --port via CLI (they ignore PORT env var)
        command = `${command} -- --port ${portStr}`;
    } else if (command.includes("manage.py") && command.includes("runserver") && !command.match(/\d{4,5}$/)) {
        // Django: append port to runserver
        command = `${command} ${portStr}`;
    } else if (command.includes("uvicorn") && !command.includes("--port")) {
        // FastAPI: add --port
        command = `${command} --port ${portStr}`;
    } else if (command.includes("flask") && !command.includes("--port")) {
        // Flask: add --port + env
        command = `${command} --port ${portStr}`;
        env.FLASK_RUN_PORT = portStr;
    }

    const cmdParts = command.split(/\s+/);

    try {
        broadcastSSE("log", { port: portStr, line: `\n[Starting process: ${command} in ${cwd}]\n` });

        const child = spawn(cmdParts[0], cmdParts.slice(1), {
            cwd,
            env,
            stdio: ["ignore", "pipe", "pipe"],
            shell: true,
        });

        const logs = [];
        const maxLogs = 200;

        child.stdout.on("data", (data) => {
            const line = data.toString();
            logs.push(line);
            if (logs.length > maxLogs) logs.shift();
            broadcastSSE("log", { port: portStr, line });
        });

        child.stderr.on("data", (data) => {
            const line = data.toString();
            logs.push(line);
            if (logs.length > maxLogs) logs.shift();
            broadcastSSE("log", { port: portStr, line });
        });

        child.on("exit", (code) => {
            console.log(`Process on port ${portStr} exited with code ${code}`);
            delete runningProcesses[portStr];
            delete config.assignments[portStr];
            saveConfig();
            broadcastSSE("state", getState());
            broadcastSSE("log", { port: portStr, line: `\n[Process exited with code ${code}]\n` });
        });

        child.on("error", (err) => {
            console.error(`Error spawning process on port ${portStr}:`, err);
            delete runningProcesses[portStr];
            delete config.assignments[portStr];
            saveConfig();
            broadcastSSE("state", getState());
            broadcastSSE("log", { port: portStr, line: `\n[Error: ${err.message}]\n` });
        });

        runningProcesses[portStr] = { process: child, appId, logs };
        config.assignments[portStr] = appId;
        saveConfig();
        broadcastSSE("state", getState());
        res.json({ ok: true, pid: child.pid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Unassign app from port (stop process)
app.post("/api/unassign", (req, res) => {
    const { port } = req.body;
    const portStr = String(port);
    killProcess(portStr);
    delete config.assignments[portStr];
    saveConfig();
    broadcastSSE("state", getState());
    res.json({ ok: true });
});

// Get logs for a port
app.get("/api/logs/:port", (req, res) => {
    const portStr = req.params.port;
    const proc = runningProcesses[portStr];
    res.json({ logs: proc ? proc.logs : [] });
});

// SSE endpoint
app.get("/api/events", (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    res.write(`event: state\ndata: ${JSON.stringify(getState())}\n\n`);
    sseClients.push(res);
    req.on("close", () => {
        const idx = sseClients.indexOf(res);
        if (idx !== -1) sseClients.splice(idx, 1);
    });
});

// Detect framework in a directory (uses dev.js --print)
app.post("/api/detect", (req, res) => {
    const { cwd } = req.body;
    if (!cwd) return res.status(400).json({ error: "cwd is required" });

    // Check if directory exists
    if (!fs.existsSync(cwd)) {
        return res.json({ detected: false, error: "디렉토리를 찾을 수 없습니다" });
    }

    try {
        const detection = devLogic.detect(cwd);
        const { name: framework, commands, env: detectedEnv } = detection;

        if (!framework || framework === "Unknown" || !commands.length) {
            return res.json({ detected: false, error: "프레임워크를 감지할 수 없습니다" });
        }

        // Use the first command as the base
        let cmdParts = commands[0];

        // If it's a port-aware command like Django/FastAPI, apply a dummy port just to get the string
        // but we'll strip it to let UI handle assignments
        const tempEnv = { ...process.env, PORT: "PORT_VAR" };
        const adjustedCommands = devLogic.applyPort(framework, commands, tempEnv);
        let command = adjustedCommands[0].join(" ");

        // Strip port-related markers since UI assigns ports via drag & drop
        command = command
            .replace(/\s+--\s+--port\s+PORT_VAR$/, "")
            .replace(/\s+--port\s+PORT_VAR$/, "")
            .replace(/\s+PORT_VAR$/, "")
            .replace(/\s+0\.0\.0\.0:PORT_VAR$/, "");

        // Infer type and icon from framework
        const typeMap = {
            "Next.js": { type: "Web", icon: "globe" },
            "Vite": { type: "Web", icon: "globe" },
            "Nuxt": { type: "Web", icon: "globe" },
            "SvelteKit": { type: "Web", icon: "globe" },
            "Remix": { type: "Web", icon: "globe" },
            "Expo": { type: "Web", icon: "globe" },
            "Node": { type: "API", icon: "code" },
            "Node (server+client)": { type: "API", icon: "code" },
            "Django": { type: "API", icon: "code" },
            "FastAPI": { type: "API", icon: "zap" },
            "Flask": { type: "API", icon: "code" },
            "Go": { type: "API", icon: "code" },
            "Gradle": { type: "API", icon: "server" },
            "Maven": { type: "API", icon: "server" },
        };
        const meta = typeMap[framework] || { type: "Service", icon: "box" };

        res.json({
            detected: true,
            framework,
            command,
            port: devLogic.defaultPorts[framework] || null,
            type: meta.type,
            icon: meta.icon,
            name: framework,
        });
    } catch (err) {
        res.json({ detected: false, error: err.message });
    }
});

// --- Process Management ---
function killProcess(portStr) {
    const proc = runningProcesses[portStr];
    if (!proc) return;
    try {
        // Kill entire process group
        process.kill(-proc.process.pid, "SIGTERM");
    } catch {
        try { proc.process.kill("SIGTERM"); } catch { /* already dead */ }
    }
    delete runningProcesses[portStr];
}

// Cleanup on exit
process.on("SIGINT", () => {
    console.log("\nShutting down... killing all running processes.");
    for (const portStr of Object.keys(runningProcesses)) {
        killProcess(portStr);
    }
    process.exit(0);
});

process.on("SIGTERM", () => {
    for (const portStr of Object.keys(runningProcesses)) {
        killProcess(portStr);
    }
    process.exit(0);
});

// --- Start ---
app.listen(UI_PORT, () => {
    console.log(`\n  🚀 dev-runner Web UI`);
    console.log(`  ➜ http://localhost:${UI_PORT}\n`);
});
