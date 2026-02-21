import { useState } from "react";
import { Typography, Button, Row, Col } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { AppState } from "../types";
import { PortSlot } from "./PortSlot";
import { AddPortModal } from "./AddPortModal";

const { Text } = Typography;

interface PortsLayoutProps {
    state: AppState;
    onOpenLogs: (port: string) => void;
}

export function PortsLayout({ state, onOpenLogs }: PortsLayoutProps) {
    const [portModalOpen, setPortModalOpen] = useState(false);
    const [portModalCategory, setPortModalCategory] = useState<"frontend" | "backend">("frontend");

    const openAddPort = (category: "frontend" | "backend") => {
        setPortModalCategory(category);
        setPortModalOpen(true);
    };

    const renderSection = (title: string, category: "frontend" | "backend") => {
        const ports = state.ports[category] || [];
        return (
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text type="secondary" strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {title}
                    </Text>
                    <Button
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => openAddPort(category)}
                        style={{ fontSize: 13 }}
                    >
                        추가
                    </Button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {ports.map((port) => (
                        <PortSlot
                            key={port}
                            port={port}
                            state={state}
                            onOpenLogs={onOpenLogs}
                        />
                    ))}
                    {ports.length === 0 && (
                        <Text type="secondary" style={{ fontSize: 13, textAlign: "center", padding: 16 }}>
                            포트를 추가하세요
                        </Text>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <Row gutter={20}>
                <Col xs={24} md={12}>
                    {renderSection("프론트엔드", "frontend")}
                </Col>
                <Col xs={24} md={12}>
                    {renderSection("백엔드", "backend")}
                </Col>
            </Row>
            <AddPortModal
                open={portModalOpen}
                category={portModalCategory}
                onClose={() => setPortModalOpen(false)}
            />
        </>
    );
}
