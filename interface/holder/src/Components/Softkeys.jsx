import React from "react";
import { usePhone } from "../Phone/PhoneContext";

export default function SoftKeys() {
    const { softKeys } = usePhone();

    return (
        <div className="px-3">
            <div
                className="flex items-center justify-between text-[11px] font-medium"
                style={{ color: "var(--muted)" }}
            >
                <span className="opacity-95">{softKeys.left}</span>
                <span className="font-semibold" style={{ color: "var(--text)" }}>
                    {softKeys.center}
                </span>
                <span className="opacity-95">{softKeys.right}</span>
            </div>

            <div
                className="mt-2 h-0.5 rounded"
                style={{ background: "linear-gradient(90deg, var(--accent-weak), rgba(14,165,233,0.0), var(--accent-weak))" }}
            />
        </div>
    );
}