/**
 * dev-runner Web UI — Frontend Application
 * Drag & Drop app cards onto port slots to start/stop processes.
 */

(() => {
    // --- Icons SVG map ---
    const ICONS = {
        globe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
        code: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
        database: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
        zap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        server: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
        radio: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><circle cx="12" cy="20" r="2"/><path d="M12 18v-6"/><path d="M20.56 5.44a15.44 15.44 0 0 0-17.12 0"/></svg>',
        box: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
        port: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    };

    // --- State ---
    let state = { apps: [], ports: { frontend: [], backend: [] }, assignments: {} };
    let draggedAppId = null;
    let logPort = null;
    let evtSource = null;
    let editingAppId = null; // null = add mode, string = edit mode

    // --- DOM refs ---
    const $appsGrid = document.getElementById("appsGrid");
    const $frontendPorts = document.getElementById("frontendPorts");
    const $backendPorts = document.getElementById("backendPorts");
    const $logPanel = document.getElementById("logPanel");
    const $logTitle = document.getElementById("logTitle");
    const $logContent = document.getElementById("logContent");
    const $logCloseBtn = document.getElementById("logCloseBtn");
    const $addAppBtn = document.getElementById("addAppBtn");
    const $addAppModal = document.getElementById("addAppModal");
    const $addAppForm = document.getElementById("addAppForm");
    const $addPortModal = document.getElementById("addPortModal");
    const $addPortForm = document.getElementById("addPortForm");
    const $portCategory = document.getElementById("portCategory");
    const $connectionStatus = document.getElementById("connectionStatus");

    // --- API helpers ---
    async function api(method, path, body) {
        const opts = { method, headers: { "Content-Type": "application/json" } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`/api${path}`, opts);
        return res.json();
    }

    // --- Rendering ---
    function getAssignedAppIds() {
        const ids = new Set();
        for (const info of Object.values(state.assignments)) {
            if (info && info.appId) ids.add(info.appId);
        }
        return ids;
    }

    function renderApps() {
        const assignedIds = getAssignedAppIds();
        $appsGrid.innerHTML = state.apps.map((app) => {
            const isAssigned = assignedIds.has(app.id);
            return `
        <div class="app-card ${isAssigned ? 'assigned' : ''}"
             draggable="${isAssigned ? 'false' : 'true'}"
             data-app-id="${app.id}" id="app-${app.id}">
          <div class="app-icon icon-${app.icon || 'box'}">${ICONS[app.icon] || ICONS.box}</div>
          <div class="app-info">
            <div class="app-name">${escapeHtml(app.name)}</div>
            <div class="app-type">${escapeHtml(app.type || 'Service')}</div>
          </div>
          <div class="app-status-dot"></div>
          <div class="app-actions-overlay">
            <div class="app-edit" data-edit-app="${app.id}" title="수정">✎</div>
            ${!isAssigned ? `<div class="app-delete" data-delete-app="${app.id}" title="삭제">✕</div>` : ''}
          </div>
        </div>
      `;
        }).join("");

        // Attach drag events
        $appsGrid.querySelectorAll(".app-card[draggable=true]").forEach((el) => {
            el.addEventListener("dragstart", onDragStart);
            el.addEventListener("dragend", onDragEnd);
        });

        // Attach edit events
        $appsGrid.querySelectorAll("[data-edit-app]").forEach((el) => {
            el.addEventListener("click", (e) => {
                e.stopPropagation();
                openEditModal(el.dataset.editApp);
            });
        });

        // Attach delete events
        $appsGrid.querySelectorAll("[data-delete-app]").forEach((el) => {
            el.addEventListener("click", (e) => {
                e.stopPropagation();
                api("DELETE", `/apps/${el.dataset.deleteApp}`);
            });
        });
    }

    function renderPorts(category, $container) {
        const ports = state.ports[category] || [];
        $container.innerHTML = ports.map((port) => {
            const portStr = String(port);
            const assignment = state.assignments[portStr];
            const isRunning = assignment && assignment.status === "running";
            const app = assignment ? assignment.app : null;

            return `
        <div class="port-slot ${isRunning ? 'running' : ''}"
             data-port="${port}" data-category="${category}"
             id="port-${port}">
          <div class="port-icon">${ICONS.port}</div>
          <div class="port-info">
            <div class="port-number">Port ${port}</div>
            ${isRunning && app
                    ? `<div class="port-app-name">${escapeHtml(app.name)}</div>`
                    : `<div class="port-status">${isRunning ? '실행 중' : '사용 가능'}</div>`
                }
          </div>
          <div class="port-actions">
            ${isRunning ? `
              <a class="port-action-btn btn-open" href="http://localhost:${port}" target="_blank" rel="noopener" title="브라우저에서 열기">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
              <button class="port-action-btn btn-logs" data-logs-port="${port}" title="로그 보기">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              </button>
              <button class="port-action-btn btn-stop" data-stop-port="${port}" title="중지">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"/></svg>
              </button>
            ` : `
              <button class="port-action-btn btn-delete-port" data-delete-port="${port}" title="포트 삭제">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            `}
          </div>
        </div>
      `;
        }).join("");
    }

    // --- Event delegation for port containers (avoids stale listener issues) ---
    function setupPortContainerEvents($container) {
        $container.addEventListener("dragover", (e) => {
            const slot = e.target.closest(".port-slot");
            if (slot) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
        });
        $container.addEventListener("dragenter", (e) => {
            const slot = e.target.closest(".port-slot");
            if (slot) { e.preventDefault(); slot.classList.add("drag-over"); }
        });
        $container.addEventListener("dragleave", (e) => {
            const slot = e.target.closest(".port-slot");
            if (!slot) return;
            const rect = slot.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                slot.classList.remove("drag-over");
            }
        });
        $container.addEventListener("drop", (e) => {
            const slot = e.target.closest(".port-slot");
            if (!slot) return;
            e.preventDefault();
            slot.classList.remove("drag-over");
            document.querySelectorAll(".port-slot.drop-target").forEach((el) => el.classList.remove("drop-target"));
            const appId = e.dataTransfer.getData("text/plain") || draggedAppId;
            const port = parseInt(slot.dataset.port);
            if (appId && port) {
                slot.classList.add("just-dropped");
                setTimeout(() => slot.classList.remove("just-dropped"), 600);
                const card = document.getElementById(`app-${appId}`);
                if (card) card.classList.add("just-assigned");
                api("POST", "/assign", { appId, port });
            }
            draggedAppId = null;
        });
        $container.addEventListener("click", (e) => {
            const stopBtn = e.target.closest("[data-stop-port]");
            if (stopBtn) { e.stopPropagation(); api("POST", "/unassign", { port: parseInt(stopBtn.dataset.stopPort) }); return; }
            const logsBtn = e.target.closest("[data-logs-port]");
            if (logsBtn) { e.stopPropagation(); openLogs(logsBtn.dataset.logsPort); return; }
            const deleteBtn = e.target.closest("[data-delete-port]");
            if (deleteBtn) { e.stopPropagation(); api("DELETE", `/ports/${deleteBtn.dataset.deletePort}`); return; }
        });
    }
    setupPortContainerEvents($frontendPorts);
    setupPortContainerEvents($backendPorts);

    function render(opts = {}) {
        renderApps(opts);
        renderPorts("frontend", $frontendPorts, opts);
        renderPorts("backend", $backendPorts, opts);
    }

    // --- Drag & Drop ---
    function onDragStart(e) {
        draggedAppId = e.currentTarget.dataset.appId;
        e.currentTarget.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", draggedAppId);
        // Highlight all port slots as potential drop targets
        document.querySelectorAll(".port-slot").forEach((el) => el.classList.add("drop-target"));
    }

    function onDragEnd(e) {
        e.currentTarget.classList.remove("dragging");
        draggedAppId = null;
        document.querySelectorAll(".port-slot.drag-over").forEach((el) => el.classList.remove("drag-over"));
        document.querySelectorAll(".port-slot.drop-target").forEach((el) => el.classList.remove("drop-target"));
    }

    // --- Logs ---
    function openLogs(port) {
        logPort = port;
        $logTitle.textContent = `Port ${port} — Logs`;
        $logContent.textContent = "";
        $logPanel.classList.add("open");

        // Load existing logs
        api("GET", `/logs/${port}`).then((data) => {
            if (data.logs) {
                $logContent.textContent = data.logs.join("");
                $logContent.scrollTop = $logContent.scrollHeight;
            }
        });
    }

    $logCloseBtn.addEventListener("click", () => {
        $logPanel.classList.remove("open");
        logPort = null;
    });

    // --- SSE ---
    function connectSSE() {
        if (evtSource) evtSource.close();
        evtSource = new EventSource("/api/events");

        evtSource.addEventListener("state", (e) => {
            state = JSON.parse(e.data);
            render();
            $connectionStatus.classList.remove("disconnected");
        });

        evtSource.addEventListener("log", (e) => {
            const data = JSON.parse(e.data);
            if (logPort && String(data.port) === String(logPort)) {
                $logContent.textContent += data.line;
                $logContent.scrollTop = $logContent.scrollHeight;
            }
        });

        evtSource.onerror = () => {
            $connectionStatus.classList.add("disconnected");
            // Auto-reconnect is handled by EventSource
        };

        evtSource.onopen = () => {
            $connectionStatus.classList.remove("disconnected");
        };
    }

    // --- Modals ---
    function openModal(modal) {
        modal.classList.add("open");
    }

    function closeModal(modal) {
        modal.classList.remove("open");
    }

    // Close modal on overlay click or close button
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeModal(overlay);
        });
    });

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const modal = btn.closest(".modal-overlay");
            if (modal) closeModal(modal);
        });
    });

    // ESC to close modals and log panel
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal-overlay.open").forEach(closeModal);
            $logPanel.classList.remove("open");
            logPort = null;
        }
    });

    // Add/Edit App
    function openAddModal() {
        editingAppId = null;
        $addAppForm.reset();
        const $ds = document.getElementById("detectStatus");
        $ds.className = "detect-status";
        $ds.innerHTML = "";
        document.querySelector("#addAppModal .modal-header h3").textContent = "어플리케이션 추가";
        document.querySelector("#addAppForm .btn-primary").textContent = "추가";
        openModal($addAppModal);
    }

    function openEditModal(appId) {
        const app = state.apps.find((a) => a.id === appId);
        if (!app) return;
        editingAppId = appId;
        const $ds = document.getElementById("detectStatus");
        $ds.className = "detect-status";
        $ds.innerHTML = "";
        // Pre-fill form fields
        document.getElementById("appCwd").value = app.cwd || "";
        document.getElementById("appName").value = app.name || "";
        document.getElementById("appType").value = app.type || "Service";
        document.getElementById("appIcon").value = app.icon || "box";
        document.getElementById("appCommand").value = app.command || "";
        // Serialize env back to KEY=VALUE text
        const envObj = app.env || {};
        document.getElementById("appEnv").value = Object.entries(envObj)
            .map(([k, v]) => `${k}=${v}`)
            .join("\n");
        document.querySelector("#addAppModal .modal-header h3").textContent = "어플리케이션 수정";
        document.querySelector("#addAppForm .btn-primary").textContent = "저장";
        openModal($addAppModal);
    }

    $addAppBtn.addEventListener("click", openAddModal);

    // Auto-detect framework
    const $detectBtn = document.getElementById("detectBtn");
    const $detectStatusEl = document.getElementById("detectStatus");

    async function detectFramework() {
        const cwd = document.getElementById("appCwd").value.trim();
        if (!cwd) return;

        // Show loading state
        $detectBtn.classList.add("loading");
        $detectBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> 감지 중...`;
        $detectStatusEl.className = "detect-status loading visible";
        $detectStatusEl.innerHTML = "🔍 프레임워크 감지 중...";

        try {
            const result = await api("POST", "/detect", { cwd });

            if (result.detected) {
                // Auto-fill all fields
                document.getElementById("appName").value = result.name || result.framework;
                document.getElementById("appCommand").value = result.command;
                document.getElementById("appType").value = result.type || "Service";
                document.getElementById("appIcon").value = result.icon || "box";

                // Show success
                $detectStatusEl.className = "detect-status success visible";
                $detectStatusEl.innerHTML = `✅ <span class="detect-framework">${escapeHtml(result.framework)}</span> 감지됨 → <code>${escapeHtml(result.command)}</code>`;
            } else {
                $detectStatusEl.className = "detect-status error visible";
                $detectStatusEl.innerHTML = `⚠️ ${escapeHtml(result.error || "프레임워크를 감지할 수 없습니다")}`;
            }
        } catch (err) {
            $detectStatusEl.className = "detect-status error visible";
            $detectStatusEl.innerHTML = `⚠️ 감지 실패: ${escapeHtml(err.message)}`;
        } finally {
            $detectBtn.classList.remove("loading");
            $detectBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> 감지`;
        }
    }

    $detectBtn.addEventListener("click", detectFramework);

    // Auto-detect on input (debounced) and Enter/paste
    let detectTimer = null;
    const $cwdInput = document.getElementById("appCwd");

    $cwdInput.addEventListener("input", () => {
        clearTimeout(detectTimer);
        const val = $cwdInput.value.trim();
        if (val.length < 3) return;
        detectTimer = setTimeout(detectFramework, 500);
    });

    $cwdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            clearTimeout(detectTimer);
            detectFramework();
        }
    });

    $addAppForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("appName").value.trim();
        const type = document.getElementById("appType").value;
        const icon = document.getElementById("appIcon").value;
        const command = document.getElementById("appCommand").value.trim();
        const cwd = document.getElementById("appCwd").value.trim();
        if (!name || !command) return;

        // Parse env vars from textarea (KEY=VALUE per line)
        const envText = document.getElementById("appEnv").value.trim();
        const env = {};
        if (envText) {
            envText.split("\n").forEach((line) => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) return; // skip empty/comments
                const eqIdx = trimmed.indexOf("=");
                if (eqIdx > 0) {
                    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
                }
            });
        }

        const envPayload = Object.keys(env).length > 0 ? env : {};
        if (editingAppId) {
            await api("PUT", `/apps/${editingAppId}`, { name, type, icon, command, cwd, env: envPayload });
        } else {
            await api("POST", "/apps", { name, type, icon, command, cwd, env: envPayload });
        }
        editingAppId = null;
        $addAppForm.reset();
        $detectStatusEl.className = "detect-status";
        $detectStatusEl.innerHTML = "";
        closeModal($addAppModal);
    });

    // Add Port
    document.querySelectorAll(".btn-add[data-category]").forEach((btn) => {
        btn.addEventListener("click", () => {
            $portCategory.value = btn.dataset.category;
            openModal($addPortModal);
        });
    });

    $addPortForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const port = parseInt(document.getElementById("portNumber").value);
        const category = $portCategory.value;
        if (!port || !category) return;

        await api("POST", "/ports", { port, category });
        $addPortForm.reset();
        closeModal($addPortModal);
    });

    // --- Utility ---
    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Init ---
    connectSSE();
})();
