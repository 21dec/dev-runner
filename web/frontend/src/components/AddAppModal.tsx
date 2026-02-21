import { useState, useEffect } from "react";
import { Modal, Form, Input, Select, Button, Alert, Space, Row, Col } from "antd";
import { ScanOutlined } from "@ant-design/icons";
import { api, detectFramework } from "../api";
import type { AppDef, DetectResult } from "../types";
import { Icon } from "../icons";

const { TextArea } = Input;

interface AddAppModalProps {
    open: boolean;
    editingApp: AppDef | null;
    onClose: () => void;
}

export function AddAppModal({ open, editingApp, onClose }: AddAppModalProps) {
    const [form] = Form.useForm();
    const [detecting, setDetecting] = useState(false);
    const [detectResult, setDetectResult] = useState<DetectResult | null>(null);

    useEffect(() => {
        if (open) {
            setDetectResult(null);
            if (editingApp) {
                const envStr = editingApp.env
                    ? Object.entries(editingApp.env)
                        .map(([k, v]) => `${k}=${v}`)
                        .join("\n")
                    : "";
                form.setFieldsValue({
                    cwd: editingApp.cwd,
                    name: editingApp.name,
                    type: editingApp.type,
                    icon: editingApp.icon,
                    command: editingApp.command,
                    env: envStr,
                    framework: editingApp.framework,
                });
            } else {
                form.resetFields();
            }
        }
    }, [open, editingApp, form]);

    const handleDetect = async () => {
        const cwd = form.getFieldValue("cwd");
        if (!cwd) return;
        setDetecting(true);
        setDetectResult(null);
        try {
            const result = await detectFramework(cwd);
            setDetectResult(result);
            if (result.detected) {
                const currentName = form.getFieldValue("name");
                form.setFieldsValue({
                    name: currentName || result.name || result.framework,
                    command: result.command,
                    type: result.type || "Service",
                    icon: result.icon || "box",
                    framework: result.framework,
                });
            }
        } catch {
            setDetectResult({ detected: false, error: "감지 실패" });
        }
        setDetecting(false);
    };

    const handleSubmit = async () => {
        const values = await form.validateFields();
        const env: Record<string, string> = {};
        if (values.env) {
            values.env.split("\n").forEach((line: string) => {
                const idx = line.indexOf("=");
                if (idx > 0) {
                    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                }
            });
        }
        const payload = {
            name: values.name,
            type: values.type || "Service",
            icon: values.icon || "box",
            command: values.command,
            cwd: values.cwd || "",
            env: Object.keys(env).length > 0 ? env : {},
            framework: values.framework,
        };

        if (editingApp) {
            await api("PUT", `/apps/${editingApp.id}`, payload);
        } else {
            await api("POST", "/apps", payload);
        }
        onClose();
    };

    return (
        <Modal
            title={editingApp ? "어플리케이션 수정" : "어플리케이션 추가"}
            open={open}
            onCancel={onClose}
            onOk={handleSubmit}
            okText={editingApp ? "저장" : "추가"}
            cancelText="취소"
            width={480}
            destroyOnClose
        >
            <Form form={form} layout="vertical" size="small" style={{ marginTop: 16 }}>
                <Form.Item label="Working Directory">
                    <Space.Compact style={{ width: "100%" }}>
                        <Form.Item name="cwd" noStyle>
                            <Input
                                placeholder="/path/to/project"
                                onPressEnter={handleDetect}
                                style={{ flex: 1, height: 24 }}
                            />
                        </Form.Item>
                        <Button
                            icon={<ScanOutlined />}
                            onClick={handleDetect}
                            loading={detecting}
                            style={{ height: 24 }}
                        >
                            감지
                        </Button>
                    </Space.Compact>
                </Form.Item>

                {detectResult && (
                    <div style={{ marginBottom: 16 }}>
                        {detectResult.detected ? (
                            <Alert
                                type="success"
                                message={`${detectResult.framework} 감지됨`}
                                showIcon
                                closable
                            />
                        ) : (
                            <Alert
                                type="warning"
                                message={detectResult.error || "프레임워크를 감지할 수 없습니다"}
                                showIcon
                                closable
                            />
                        )}
                    </div>
                )}

                <Row gutter={10}>
                    <Col span={12}>
                        <Form.Item label="이름" name="name" rules={[{ required: true, message: "이름을 입력하세요" }]} style={{ margin: 0 }}>
                            <Input placeholder="My App" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="프레임워크" name="framework" style={{ margin: 0 }}>
                            <Input placeholder="예: Next.js, FastAPI" />
                        </Form.Item>
                    </Col>
                </Row>
                <div style={{ height: 16 }} />

                <Form.Item label="실행 명령어" name="command" rules={[{ required: true, message: "명령어를 입력하세요" }]}>
                    <Input placeholder="npm run dev" />
                </Form.Item>

                <Row gutter={10}>
                    <Col span={12}>
                        <Form.Item label="타입" name="type" initialValue="Service" style={{ margin: 0 }}>
                            <Select
                                style={{ width: "100%" }}
                                options={[
                                    { value: "Web", label: "Web" },
                                    { value: "API", label: "API" },
                                    { value: "Service", label: "Service" },
                                    { value: "Worker", label: "Worker" },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="아이콘" name="icon" initialValue="box" style={{ margin: 0 }}>
                            <Select
                                style={{ width: "100%" }}
                                options={[
                                    { value: "globe", label: <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="globe" size={14} style={{ marginRight: 6 }} /> Globe</span> },
                                    { value: "code", label: <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="code" size={14} style={{ marginRight: 6 }} /> Code</span> },
                                    { value: "server", label: <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="server" size={14} style={{ marginRight: 6 }} /> Server</span> },
                                    { value: "database", label: <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="database" size={14} style={{ marginRight: 6 }} /> Database</span> },
                                    { value: "zap", label: <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="zap" size={14} style={{ marginRight: 6 }} /> Zap</span> },
                                    { value: "radio", label: <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="radio" size={14} style={{ marginRight: 6 }} /> Radio</span> },
                                    { value: "box", label: <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="box" size={14} style={{ marginRight: 6 }} /> Box</span> },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                </Row>
                <div style={{ height: 16 }} />

                <Form.Item label="환경 변수" name="env">
                    <TextArea rows={3} placeholder={"KEY=value\nANOTHER=value"} style={{ fontFamily: "monospace", fontSize: 11 }} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
