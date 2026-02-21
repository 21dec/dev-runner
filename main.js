/**
 * dev-runner Electron Main Process
 * Launches Express server internally and opens a BrowserWindow.
 */

const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

// Start Express server
require("./web/server.js");

const UI_PORT = 4444;

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
