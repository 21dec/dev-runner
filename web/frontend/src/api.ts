import type { AppState, DetectResult } from "./types";

export async function api<T = unknown>(
    method: string,
    path: string,
    body?: unknown
): Promise<T> {
    const res = await fetch(`/api${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
}

export function connectSSE(
    onState: (state: AppState) => void,
    onLog: (data: { port: string; line: string }) => void,
    onConnect: () => void,
    onDisconnect: () => void
): () => void {
    const evtSource = new EventSource("/api/events");

    evtSource.addEventListener("state", (e) => {
        onState(JSON.parse(e.data));
    });

    evtSource.addEventListener("log", (e) => {
        onLog(JSON.parse(e.data));
    });

    evtSource.onerror = () => onDisconnect();
    evtSource.onopen = () => onConnect();

    return () => evtSource.close();
}

export async function detectFramework(cwd: string): Promise<DetectResult> {
    return api<DetectResult>("POST", "/detect", { cwd });
}
