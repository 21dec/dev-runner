export interface AppDef {
    id: string;
    name: string;
    type: string;
    icon: string;
    command: string;
    cwd: string;
    env?: Record<string, string>;
}

export interface Assignment {
    appId: string;
    status: "assigned" | "running";
    app: AppDef | null;
}

export interface AppState {
    apps: AppDef[];
    ports: {
        frontend: number[];
        backend: number[];
    };
    assignments: Record<string, Assignment>;
}

export interface DetectResult {
    detected: boolean;
    framework?: string;
    command?: string;
    port?: number;
    type?: string;
    icon?: string;
    name?: string;
    error?: string;
}
