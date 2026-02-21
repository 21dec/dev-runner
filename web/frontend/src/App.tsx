import { useState, useEffect, useCallback, useRef } from "react";
import { ConfigProvider, App as AntApp, Layout, theme } from "antd";
import { DndContext, DragOverlay, DragStartEvent, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { connectSSE, api } from "./api";
import type { AppState } from "./types";
import { Header } from "./components/Header";
import { AppsSection } from "./components/AppsSection";
import { PortsLayout } from "./components/PortsLayout";
import { LogPanel } from "./components/LogPanel";
import { AppCard } from "./components/AppCard";
import "./index.css";

const { Content } = Layout;

export default function App() {
    const [state, setState] = useState<AppState>({
        apps: [],
        ports: { frontend: [], backend: [] },
        assignments: {},
    });
    const [connected, setConnected] = useState(false);
    const [logPort, setLogPort] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const logsRef = useRef<Record<string, string[]>>({});

    const handleLog = useCallback((data: { port: string; line: string }) => {
        if (!logsRef.current[data.port]) logsRef.current[data.port] = [];
        const arr = logsRef.current[data.port];
        arr.push(data.line);
        if (arr.length > 200) arr.shift();
        // Force re-render if viewing this port's logs
        setLogPort((prev: string | null) => (prev === data.port ? data.port : prev));
    }, []);

    useEffect(() => {
        const close = connectSSE(
            setState,
            handleLog,
            () => setConnected(true),
            () => setConnected(false)
        );
        return close;
    }, [handleLog]);

    const getAssignedAppIds = useCallback((): Set<string> => {
        const ids = new Set<string>();
        for (const info of Object.values(state.assignments)) {
            if (typeof info === "object" && info !== null && "appId" in info) {
                ids.add((info as { appId: string }).appId);
            } else if (typeof info === "string") {
                ids.add(info);
            }
        }
        return ids;
    }, [state.assignments]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Require 5px movement before drag starts to prevent clicking issues
            },
        })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (active && over && over.id) {
            api("POST", "/assign", { appId: active.id as string, port: Number(over.id) });
        }
    }, []);

    const activeApp = activeId ? state.apps.find((a) => a.id === activeId) : null;

    return (
        <ConfigProvider
            theme={{
                algorithm: theme.compactAlgorithm,
                token: {
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
                    fontSize: 14,
                    borderRadius: 8,
                    colorPrimary: "#007aff",
                    colorSuccess: "#34c759",
                    colorError: "#ff3b30",
                    colorWarning: "#ff9500",
                },
            }}
        >
            <AntApp>
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <Layout style={{ minHeight: "100vh", background: "#f2f2f7" }}>
                        <Content style={{ maxWidth: "55%", minWidth: 700, margin: "0 auto", padding: "16px 24px 80px", width: "100%" }}>
                            <Header connected={connected} />
                            <AppsSection
                                apps={state.apps}
                                assignedIds={getAssignedAppIds()}
                            />
                            <PortsLayout
                                state={state}
                                onOpenLogs={setLogPort}
                            />
                        </Content>
                        <LogPanel
                            port={logPort}
                            logs={logPort ? logsRef.current[logPort] || [] : []}
                            onClose={() => setLogPort(null)}
                        />
                    </Layout>
                    <DragOverlay dropAnimation={null}>
                        {activeApp ? (
                            <AppCard
                                app={activeApp}
                                isAssigned={false}
                                onEdit={() => { }}
                                isOverlay
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </AntApp>
        </ConfigProvider>
    );
}
