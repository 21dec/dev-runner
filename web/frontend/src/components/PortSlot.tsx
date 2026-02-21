import { Card, Typography, Button, Space, Tag, Popconfirm } from "antd";
import {
    PlayCircleOutlined,
    StopOutlined,
    CodeOutlined,
    LinkOutlined,
    DeleteOutlined,
} from "@ant-design/icons";
import { useDroppable } from "@dnd-kit/core";
import { api } from "../api";
import type { AppState } from "../types";
import { Icon } from "../icons";

const { Text } = Typography;

interface PortSlotProps {
    port: number;
    state: AppState;
    onOpenLogs: (port: string) => void;
}

export function PortSlot({
    port,
    state,
    onOpenLogs,
}: PortSlotProps) {
    const portStr = String(port);
    const assignment = state.assignments[portStr];
    const isRunning = assignment && assignment.status === "running";
    const app = assignment?.app;

    const { setNodeRef, isOver } = useDroppable({
        id: portStr,
        data: { type: "PortSlot", port },
    });

    return (
        <Card
            ref={setNodeRef}
            size="small"
            style={{
                borderRadius: 10,
                borderColor: isRunning ? "#34c759" : isOver ? "#007aff" : undefined,
                background: isRunning
                    ? "#f0fdf4"
                    : isOver
                        ? "#e8f0fe"
                        : undefined,
                transition: "all 180ms ease",
                transform: isOver ? "scale(1.02) translateY(-2px)" : "scale(1)",
                boxShadow: isOver ? "0 8px 20px rgba(0, 122, 255, 0.15)" : undefined,
            }}
            styles={{ body: { padding: "8px 12px" } }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                    style={{
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 6,
                        background: isRunning ? "#dcfce7" : "#f5f5f5",
                        color: isRunning ? "#28a745" : "#a3a3a3",
                        flexShrink: 0,
                    }}
                >
                    <Icon name="port" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: 14 }}>
                        Port {port}
                    </Text>
                    <br />
                    {isRunning && app ? (
                        <Text style={{ fontSize: 13, color: "#525252" }}>{app.name}</Text>
                    ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            사용 가능
                        </Text>
                    )}
                </div>
                <Space size={4}>
                    {isRunning ? (
                        <>
                            <Button
                                type="text"
                                size="small"
                                icon={<LinkOutlined />}
                                href={`http://localhost:${port}`}
                                target="_blank"
                                title="브라우저에서 열기"
                                style={{ fontSize: 13 }}
                            />
                            <Button
                                type="text"
                                size="small"
                                icon={<CodeOutlined />}
                                onClick={() => onOpenLogs(portStr)}
                                title="로그 보기"
                                style={{ fontSize: 13 }}
                            />
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<StopOutlined />}
                                onClick={() => api("POST", "/unassign", { port })}
                                title="중지"
                                style={{ fontSize: 13 }}
                            />
                        </>
                    ) : (
                        <Popconfirm
                            title="포트 삭제"
                            description="이 포트를 삭제하시겠습니까?"
                            onConfirm={() => api("DELETE", `/ports/${port}`)}
                            okText="삭제"
                            cancelText="취소"
                            okButtonProps={{ danger: true, size: "small" }}
                            cancelButtonProps={{ size: "small" }}
                        >
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                title="포트 삭제"
                                style={{ fontSize: 13 }}
                            />
                        </Popconfirm>
                    )}
                </Space>
            </div>
        </Card>
    );
}
