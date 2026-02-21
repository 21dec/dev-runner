import { Card, Typography, Tag, Popconfirm, Button, Space } from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { api } from "../api";
import type { AppDef } from "../types";
import { Icon } from "../icons";

const { Text } = Typography;

interface AppCardProps {
    app: AppDef;
    isAssigned: boolean;
    onEdit: (id: string) => void;
    setDraggedAppId: (id: string | null) => void;
}

export function AppCard({ app, isAssigned, onEdit, setDraggedAppId }: AppCardProps) {
    return (
        <Card
            size="small"
            id={`app-${app.id}`}
            draggable={!isAssigned}
            onDragStart={(e) => {
                setDraggedAppId(app.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", app.id);
            }}
            onDragEnd={() => setDraggedAppId(null)}
            style={{
                cursor: isAssigned ? "default" : "grab",
                opacity: isAssigned ? 0.45 : 1,
                transition: "all 180ms ease",
                borderRadius: 10,
            }}
            hoverable={!isAssigned}
            styles={{ body: { padding: "8px 12px" } }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                    className={`app-icon icon-${app.icon || "box"}`}
                    style={{
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 8,
                        background: "#f5f5f5",
                        color: "#737373",
                        flexShrink: 0,
                    }}
                >
                    <Icon name={app.icon || "box"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: 600, display: "block" }}>{app.name}</Text>
                    <Tag color="default" style={{ fontSize: 11, lineHeight: "16px", marginTop: 4 }}>
                        {app.type || "Service"}
                    </Tag>
                </div>
                {!isAssigned && (
                    <Space size={4}>
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => onEdit(app.id)}
                        />
                        <Popconfirm
                            title="앱 삭제"
                            description="이 앱을 삭제하시겠습니까?"
                            onConfirm={() => api("DELETE", `/apps/${app.id}`)}
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
                            />
                        </Popconfirm>
                    </Space>
                )}
            </div>
        </Card>
    );
}
