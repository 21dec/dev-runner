import { Modal, Form, InputNumber, Select } from "antd";
import { api } from "../api";

interface AddPortModalProps {
    open: boolean;
    category: "frontend" | "backend";
    onClose: () => void;
}

export function AddPortModal({ open, category, onClose }: AddPortModalProps) {
    const [form] = Form.useForm();

    const handleSubmit = async () => {
        const values = await form.validateFields();
        await api("POST", "/ports", {
            port: values.port,
            category: values.category,
        });
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            title="포트 추가"
            open={open}
            onCancel={onClose}
            onOk={handleSubmit}
            okText="추가"
            cancelText="취소"
            width={360}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                size="small"
                initialValues={{ category }}
                style={{ marginTop: 16 }}
            >
                <Form.Item
                    label="포트 번호"
                    name="port"
                    rules={[{ required: true, message: "포트 번호를 입력하세요" }]}
                >
                    <InputNumber
                        min={1024}
                        max={65535}
                        placeholder="3000"
                        style={{ width: "100%" }}
                    />
                </Form.Item>
                <Form.Item label="카테고리" name="category">
                    <Select
                        options={[
                            { value: "frontend", label: "프론트엔드" },
                            { value: "backend", label: "백엔드" },
                        ]}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
