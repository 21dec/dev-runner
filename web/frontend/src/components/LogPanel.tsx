import { useEffect, useRef } from "react";
import { Drawer, Typography } from "antd";

const { Text } = Typography;

interface LogPanelProps {
    port: string | null;
    logs: string[];
    onClose: () => void;
}

export function LogPanel({ port, logs, onClose }: LogPanelProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs.length]);

    return (
        <Drawer
            title={port ? `Port ${port} — Logs` : "Logs"}
            open={!!port}
            onClose={onClose}
            placement="bottom"
            height={320}
            styles={{
                body: {
                    padding: 0,
                    background: "#1a1a2e",
                    fontFamily: "'SF Mono', 'Menlo', monospace",
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "#d4d4d4",
                    overflow: "auto",
                },
            }}
        >
            <div style={{ padding: "8px 16px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {logs.length === 0 ? (
                    <Text type="secondary" style={{ color: "#666" }}>
                        로그를 대기 중...
                    </Text>
                ) : (
                    logs.map((line, i) => <div key={i}>{line}</div>)
                )}
                <div ref={bottomRef} />
            </div>
        </Drawer>
    );
}
