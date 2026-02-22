import { Badge, Space, Typography } from "antd";
import { RocketOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

interface HeaderProps {
    connected: boolean;
}

export function Header({ connected }: HeaderProps) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0 20px",
                ["WebkitAppRegion" as any]: "drag",
            }}
        >
            <Space
                size={8}
                align="center"
                style={{ ["WebkitAppRegion" as any]: "no-drag" }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(180deg, #007aff, #0062cc)",
                        color: "white",
                        borderRadius: 6,
                        fontSize: 15,
                    }}
                >
                    <RocketOutlined />
                </div>
                <Title level={5} style={{ margin: 0, fontSize: 17, letterSpacing: -0.3 }}>
                    dev-runner
                </Title>
            </Space>
            <Space
                size={8}
                style={{ ["WebkitAppRegion" as any]: "no-drag", height: 22, alignItems: "center", display: "flex" }}
            >
                {connected ? (
                    <div className="status-dot-blinking" title="연결됨" />
                ) : (
                    <>
                        <Badge status="error" />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            연결 끊김
                        </Text>
                    </>
                )}
            </Space>
        </div>
    );
}
