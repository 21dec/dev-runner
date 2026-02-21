import { useState } from "react";
import { Typography, Button, Row, Col } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { AppDef } from "../types";
import { AppCard } from "./AppCard";
import { AddAppModal } from "./AddAppModal";

const { Text } = Typography;

interface AppsSectionProps {
    apps: AppDef[];
    assignedIds: Set<string>;
    draggedAppId: string | null;
    setDraggedAppId: (id: string | null) => void;
}

export function AppsSection({ apps, assignedIds, draggedAppId, setDraggedAppId }: AppsSectionProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingApp, setEditingApp] = useState<AppDef | null>(null);

    const handleEdit = (id: string) => {
        const app = apps.find((a) => a.id === id);
        if (app) {
            setEditingApp(app);
            setModalOpen(true);
        }
    };

    const handleAdd = () => {
        setEditingApp(null);
        setModalOpen(true);
    };

    return (
        <section style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Text type="secondary" strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    어플리케이션
                </Text>
                <Button type="link" size="small" icon={<PlusOutlined />} onClick={handleAdd} style={{ fontSize: 13 }}>
                    추가
                </Button>
            </div>
            <Row gutter={[20, 10]}>
                {apps.map((app) => (
                    <Col key={app.id} xs={24} md={12}>
                        <AppCard
                            app={app}
                            isAssigned={assignedIds.has(app.id)}
                            onEdit={handleEdit}
                            setDraggedAppId={setDraggedAppId}
                        />
                    </Col>
                ))}
            </Row>
            <AddAppModal
                open={modalOpen}
                editingApp={editingApp}
                onClose={() => {
                    setModalOpen(false);
                    setEditingApp(null);
                }}
            />
        </section>
    );
}
