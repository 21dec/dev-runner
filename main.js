/**
 * dev-runner Electron Main Process
 * Launches Express server internally and opens a BrowserWindow.
 */

const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

// Fix PATH for macOS double-click launch
if (process.platform === "darwin") {
    const extraPaths = ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin", "/opt/homebrew/bin", "/opt/homebrew/sbin"];
    const currentPath = process.env.PATH || "";
    const paths = currentPath.split(":");
    extraPaths.forEach(p => {
        if (!paths.includes(p)) paths.push(p);
    });
    process.env.PATH = paths.join(":");
}

// Setup writable config path
const userDataPath = app.getPath("userData");
const configPath = path.join(userDataPath, "apps.json");
const logPath = path.join(userDataPath, "debug.log");

// Redirect console to file for debugging
const logStream = fs.createWriteStream(logPath, { flags: "a" });
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    const msg = `[${new Date().toISOString()}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(" ") + "\n";
    logStream.write(msg);
    originalLog.apply(console, args);
};

console.error = (...args) => {
    const msg = `[${new Date().toISOString()}] ERROR: ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(" ") + "\n";
    logStream.write(msg);
    originalError.apply(console, args);
};

console.log("App startup. Config path:", configPath);
console.log("PATH:", process.env.PATH);

// Create user data directory if it doesn't exist
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

// Copy default apps.json if it doesn't exist in user data folder
const bundledConfigPath = path.join(__dirname, "web", "apps.json");
if (!fs.existsSync(configPath) && fs.existsSync(bundledConfigPath)) {
    try {
        fs.copyFileSync(bundledConfigPath, configPath);
        console.log("Copied default config to:", configPath);
    } catch (err) {
        console.error("Failed to copy default config:", err);
    }
}

const UI_PORT = 4444;
process.env.UI_PORT = UI_PORT;
process.env.DEV_RUNNER_CONFIG_PATH = configPath;

// Start Express server
require("./web/server.js");

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 900,
        minHeight: 600,
        title: "dev-runner",
        titleBarStyle: "hiddenInset",
        trafficLightPosition: { x: 16, y: 16 },
        backgroundColor: "#f9fafb",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    win.loadURL(`http://localhost:${UI_PORT}`);

    // Create standard menu for copy/paste
    const template = [
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "selectAll" }
            ]
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" }
            ]
        },
        {
            label: "Window",
            submenu: [
                { role: "minimize" },
                { role: "zoom" },
                { role: "close" }
            ]
        }
    ];

    if (process.platform === "darwin") {
        template.unshift({
            label: app.name,
            submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Open external links in default browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });
}

app.whenReady().then(() => {
    // Small delay to ensure Express is listening
    setTimeout(createWindow, 500);

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
