import {
    GlobalOutlined,
    CodeOutlined,
    HddOutlined,
    DatabaseOutlined,
    ThunderboltOutlined,
    ApiOutlined,
    AppstoreOutlined,
    NodeIndexOutlined,
} from "@ant-design/icons";
import React from "react";

const ICON_MAP: Record<string, React.ComponentType<any>> = {
    globe: GlobalOutlined,
    code: CodeOutlined,
    server: HddOutlined,
    database: DatabaseOutlined,
    zap: ThunderboltOutlined,
    radio: ApiOutlined,
    box: AppstoreOutlined,
    port: NodeIndexOutlined,
};

export function Icon({ name, size, style, className }: { name: string; size?: number; style?: React.CSSProperties; className?: string }) {
    const Component = ICON_MAP[name] || AppstoreOutlined;
    const computedStyle = size ? { ...style, fontSize: size } : style;

    return <Component style={computedStyle} className={className} />;
}
