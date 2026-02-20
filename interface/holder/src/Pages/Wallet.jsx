import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePhone } from "../Phone/PhoneContext";

const API = import.meta.env.VITE_API_BASE || "http://localhost:3000";
const STATIC_PIN = import.meta.env.VITE_HOLDER_PIN || "91563";

function CardRow({ active, title, subtitle, lines = [], innerRef }) {
    return (
        <div
            ref={innerRef}
            className="px-3 py-2 border-b last:border-b-0"
            style={{
                borderColor: "var(--line)",
                background: active
                    ? "linear-gradient(90deg, var(--accent-weak), rgba(14,165,233,0.0))"
                    : "transparent",
                borderLeft: active ? "4px solid rgba(14,165,233,0.65)" : "4px solid transparent",
            }}
        >
            <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
                {title}
            </div>

            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                {subtitle}
            </div>

            {lines.length > 0 && (
                <div className="mt-2 space-y-1 text-[11px]" style={{ color: "var(--text)" }}>
                    {lines.map((x, i) => (
                        <div key={i} className="flex justify-between gap-3">
                            <span style={{ color: "var(--muted)" }}>{x.k}</span>
                            <span className="font-medium truncate">{x.v}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Wallet() {
    const { setSoftKeys, setHandlers } = usePhone();

    const [unlocked, setUnlocked] = useState(false);
    const [pin, setPin] = useState("");
    const pinRef = useRef("");
    useEffect(() => {
        pinRef.current = pin;
    }, [pin]);

    const [pinError, setPinError] = useState("");

    const [rows, setRows] = useState([]);
    const [err, setErr] = useState("");
    const [idx, setIdx] = useState(0);

    const itemRefs = useRef([]);

    function hasEncryptedClaims(c) {
        const cl = c?.claims;
        return !!(cl && typeof cl === "object" && cl.iv && cl.content && cl.tag);
    }

    function pickClaim(claims, key) {
        if (!claims) return "";
        const v = claims[key];
        return v === undefined || v === null ? "" : String(v);
    }

    async function loadUnlocked() {
        setErr("");
        try {
            const res = await fetch(`${API}/api/holder/wallet`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin: STATIC_PIN }),
            });

            if (res.ok) {
                const data = await res.json();
                const items = data.items || [];
                setRows(items);
                setIdx((v) => Math.min(v, Math.max(0, items.length - 1)));
                return;
            }

            const fallback = await fetch(`${API}/api/credentials`);
            const data2 = await fallback.json();
            if (!fallback.ok) throw new Error(data2?.error || "Failed");
            const items2 = data2.items || [];
            setRows(items2);
            setIdx((v) => Math.min(v, Math.max(0, items2.length - 1)));
        } catch (e) {
            setErr(e.message);
        }
    }

    function handleUnlockOk() {
        const v = String(pinRef.current || "");
        if (v !== STATIC_PIN) {
            setPinError("Invalid PIN");
            return;
        }
        setPinError("");
        setUnlocked(true);
    }

    useEffect(() => {
        if (!unlocked) return;
        loadUnlocked();
    }, [unlocked]);

    useEffect(() => {
        if (!unlocked) {
            setSoftKeys({ left: "Clear", center: "OK", right: "Del" });

            setHandlers({
                onDigit: (d) => {
                    if (!/^\d$/.test(String(d))) return;
                    setPin((s) => (s.length < 6 ? s + String(d) : s));
                },
                onBackspace: () => setPin((s) => s.slice(0, -1)),
                onClear: () => setPin(""),
                onOk: () => handleUnlockOk(),
                onCall: () => handleUnlockOk(),
                onLeftSoft: () => setPin(""),
                onRightSoft: () => setPin((s) => s.slice(0, -1)),
            });

            return;
        }

        setSoftKeys({ left: "Refresh", center: "OK", right: "Back" });

        setHandlers({
            onUp: () => setIdx((v) => (rows.length ? (v - 1 + rows.length) % rows.length : 0)),
            onDown: () => setIdx((v) => (rows.length ? (v + 1) % rows.length : 0)),
            onDigit: (d) => {
                const n = parseInt(d, 10);
                if (!Number.isNaN(n) && n >= 1 && n <= rows.length) {
                    setIdx(n - 1);
                }
            },
            onLeftSoft: () => loadUnlocked(),
        });
    }, [unlocked, rows.length, setHandlers, setSoftKeys]);

    useEffect(() => {
        if (!unlocked) return;
        const el = itemRefs.current[idx];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [idx, unlocked]);

    const view = useMemo(() => rows, [rows]);

    const pinMask = pin.length ? "•".repeat(pin.length) : "_____";

    if (!unlocked) {
        return (
            <div className="p-3">
                <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    Wallet
                </div>

                <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                    Enter PIN to view wallet
                </div>

                <div
                    className="mt-3 rounded-2xl border p-3"
                    style={{ borderColor: "var(--line)", background: "rgba(255,255,255,0.85)" }}
                >
                    <div className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>
                        PIN
                    </div>
                    <div className="mt-1 text-[16px] font-mono tracking-widest break-all" style={{ color: "var(--text)" }}>
                        {pinMask}
                    </div>
                    <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                        DEL=backspace • CLR=clear • OK/CALL=unlock
                    </div>
                </div>

                {pinError ? (
                    <div
                        className="mt-2 text-[11px] rounded-xl border px-2 py-2"
                        style={{ borderColor: "rgba(251,113,133,0.45)", background: "var(--bad-weak)", color: "var(--text)" }}
                    >
                        {pinError}
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className="p-3">
            <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                Wallet
            </div>

            <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                ▲▼ browse • 1–9 jump
            </div>

            {err ? (
                <div
                    className="mt-3 rounded-2xl border px-3 py-2 text-[12px]"
                    style={{
                        borderColor: "rgba(251,113,133,0.45)",
                        background: "var(--bad-weak)",
                        color: "var(--text)",
                    }}
                >
                    Error: {err}
                </div>
            ) : null}

            <div className="mt-3 rounded-2xl border overflow-y-auto max-h-60" style={{ borderColor: "var(--line)" }}>
                {view.length === 0 ? (
                    <div className="px-3 py-3 text-[12px]" style={{ color: "var(--muted)" }}>
                        No credentials yet.
                    </div>
                ) : (
                    view.map((c, i) => {
                        const credType = (c?.type || "Credential").toString();
                        const isRejected = c.status === "rejected";
                        const encrypted = hasEncryptedClaims(c);

                        const name = encrypted ? "" : pickClaim(c.claims, "name") || pickClaim(c.claims, "Name");
                        const numeric = encrypted ? "" : pickClaim(c.claims, "numeric") || pickClaim(c.claims, "age");
                        const mobile = encrypted ? "" : pickClaim(c.claims, "phone") || pickClaim(c.claims, "email");

                        const lines = isRejected
                            ? [{ k: "Status", v: "Rejected" }]
                            : encrypted
                                ? [{ k: "Status", v: "Encrypted" }]
                                : [
                                    { k: "Name", v: name || "-" },
                                    { k: "Numerics", v: numeric || "-" },
                                    { k: "Mobile", v: mobile || "-" },
                                ];

                        return (
                            <CardRow
                                key={c._id}
                                active={i === idx}
                                innerRef={(el) => (itemRefs.current[i] = el)}
                                title={`${i + 1}. ${credType}`}
                                subtitle={`status: ${c.status}`}
                                lines={lines}
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
}