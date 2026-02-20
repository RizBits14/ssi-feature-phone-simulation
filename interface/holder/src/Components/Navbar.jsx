import React, { useEffect, useMemo, useState } from "react";
import { FiBattery, FiWifi } from "react-icons/fi";

function pad2(n) {
    return String(n).padStart(2, "0");
}

export default function Navbar({ title = "SSI SIM" }) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(t);
    }, []);

    const timeStr = useMemo(() => {
        const h = now.getHours();
        const m = now.getMinutes();
        return `${pad2(h)}:${pad2(m)}`;
    }, [now]);

    return (
        <div className="w-full px-3 pt-2">
            <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--muted)" }}>
                <div className="flex items-center gap-2">
                    <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: "var(--good)" }}
                        title="Signal"
                    />
                    <span className="opacity-90 text-black font-bold">4G</span>
                    <FiWifi className="opacity-80" />
                </div>

                <div className="font-bold tracking-wide text-black" style={{ color: "var(--text)" }}>
                    {timeStr}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] opacity-80">86%</span>
                    <FiBattery className="opacity-90" />
                </div>
            </div>

            <div
                className="mt-2 rounded-xl border px-3 py-2"
                style={{
                    background: "var(--screen-bg)",
                    borderColor: "var(--line)",
                }}
            >
                <div className="text-[12px] font-semibold truncate" style={{ color: "var(--text)" }}>
                    {title}
                </div>
            </div>
        </div>
    );
}