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
                WebkitAppRegion: "drag" as unknown as string,
            }}
        >
            <Space
                size={8}
                align="center"
                style={{ WebkitAppRegion: "no-drag" as unknown as string }}
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
                style={{ WebkitAppRegion: "no-drag" as unknown as string }}
            >
                <Badge status={connected ? "success" : "error"} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                    {connected ? "연결됨" : "연결 끊김"}
                </Text>
            </Space>
        </div>
    );
}
