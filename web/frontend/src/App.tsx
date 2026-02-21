import { useState, useEffect, useCallback, useRef } from "react";
import { ConfigProvider, App as AntApp, Layout, theme } from "antd";
import { connectSSE } from "./api";
import type { AppState } from "./types";
import { Header } from "./components/Header";
import { AppsSection } from "./components/AppsSection";
import { PortsLayout } from "./components/PortsLayout";
import { LogPanel } from "./components/LogPanel";
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
    const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
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
                <Layout style={{ minHeight: "100vh", background: "#f2f2f7" }}>
                    <Content style={{ maxWidth: "55%", minWidth: 700, margin: "0 auto", padding: "16px 24px 80px", width: "100%" }}>
                        <Header connected={connected} />
                        <AppsSection
                            apps={state.apps}
                            assignedIds={getAssignedAppIds()}
                            draggedAppId={draggedAppId}
                            setDraggedAppId={setDraggedAppId}
                        />
                        <PortsLayout
                            state={state}
                            draggedAppId={draggedAppId}
                            setDraggedAppId={setDraggedAppId}
                            onOpenLogs={setLogPort}
                        />
                    </Content>
                    <LogPanel
                        port={logPort}
                        logs={logPort ? logsRef.current[logPort] || [] : []}
                        onClose={() => setLogPort(null)}
                    />
                </Layout>
            </AntApp>
        </ConfigProvider>
    );
}
