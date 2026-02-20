import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { usePhone } from "../Phone/PhoneContext";

const ITEMS = [
    { label: "1. Holder", path: "/holder", tone: "accent" },
    { label: "2. Wallet", path: "/wallet", tone: "good" },
];

function Row({ active, text, tone }) {
    const bg =
        active && tone === "good"
            ? "linear-gradient(90deg, var(--good-weak), rgba(16,185,129,0.0))"
            : active
                ? "linear-gradient(90deg, var(--accent-weak), rgba(14,165,233,0.0))"
                : "transparent";

    const left =
        active && tone === "good" ? "rgba(16,185,129,0.65)" : active ? "rgba(14,165,233,0.65)" : "transparent";

    return (
        <div
            className="px-3 py-2 text-[13px] border-b last:border-b-0"
            style={{
                background: bg,
                borderColor: "var(--line)",
                borderLeft: active ? `4px solid ${left}` : "4px solid transparent",
                color: "var(--text)",
            }}
        >
            {text}
        </div>
    );
}

export default function HomeMenu() {
    const [idx, setIdx] = useState(0);
    const nav = useNavigate();
    const { setHandlers, setSoftKeys } = usePhone();

    useEffect(() => {
        setSoftKeys({ left: "Select", center: "OK", right: "Exit" });

        setHandlers({
            onUp: () => setIdx((v) => (v - 1 + ITEMS.length) % ITEMS.length),
            onDown: () => setIdx((v) => (v + 1) % ITEMS.length),
            onOk: () => nav(ITEMS[idx].path),
            onDigit: (d) => {
                const n = parseInt(d, 10);
                if (!Number.isNaN(n) && n >= 1 && n <= ITEMS.length) nav(ITEMS[n - 1].path);
            },
            onBack: () => nav("/"),
        });
    }, [idx, nav, setHandlers, setSoftKeys]);

    return (
        <div className="p-3">
            <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
                Welcome
            </div>
            <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                Use ▲▼ to move • OK to open • press 1–2 to jump
            </div>

            <div className="mt-3 rounded-2xl border overflow-hidden font-semibold" style={{ borderColor: "var(--line)" }}>
                {ITEMS.map((it, i) => (
                    <Row key={it.label} active={i === idx} text={it.label} tone={it.tone} />
                ))}
            </div>

            <div className="mt-3 text-[11px]" style={{ color: "var(--muted)" }}>
                Tip: Press END to return Home anytime.
            </div>
        </div>
    );
}