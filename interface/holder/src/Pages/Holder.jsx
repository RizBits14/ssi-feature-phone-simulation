import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePhone } from "../Phone/PhoneContext";

const API = import.meta.env.VITE_API_BASE || "http://localhost:3000";
const STATIC_PIN = import.meta.env.VITE_HOLDER_PIN || "91563";

const SCREENS = {
    MAIN: "MAIN",
    ENTER: "ENTER",
    OFFERS: "OFFERS",
    ACCEPTED: "ACCEPTED",
    PROOFS: "PROOFS",
    PIN: "PIN",
};

function Panel({ title, hint, children }) {
    return (
        <div
            className="mt-3 rounded-2xl border p-3"
            style={{
                borderColor: "var(--line)",
                background: "rgba(255,255,255,0.82)",
            }}
        >
            <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                {title}
            </div>
            {hint ? (
                <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                    {hint}
                </div>
            ) : null}
            <div className="mt-3">{children}</div>
        </div>
    );
}

function CardRow({ active, title, subtitle, tone = "accent", innerRef, rightTag }) {
    const accent =
        tone === "good"
            ? "rgba(16,185,129,0.65)"
            : tone === "warn"
                ? "rgba(245,158,11,0.60)"
                : tone === "bad"
                    ? "rgba(251,113,133,0.60)"
                    : "rgba(14,165,233,0.60)";

    const bg =
        tone === "good"
            ? "linear-gradient(90deg, var(--good-weak), rgba(16,185,129,0.0))"
            : tone === "warn"
                ? "linear-gradient(90deg, #fffbeb, rgba(245,158,11,0.0))"
                : tone === "bad"
                    ? "linear-gradient(90deg, var(--bad-weak), rgba(251,113,133,0.0))"
                    : "linear-gradient(90deg, var(--accent-weak), rgba(14,165,233,0.0))";

    return (
        <div
            ref={innerRef}
            className="rounded-xl border px-3 py-2 mb-2"
            style={{
                borderColor: active ? accent : "var(--line)",
                background: active ? bg : "rgba(255,255,255,0.90)",
                boxShadow: active ? "0 0 0 2px rgba(15,23,42,0.03)" : "none",
            }}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
                    {title}
                </div>
                {rightTag ? (
                    <div
                        className="text-[10px] px-2 py-0.5 rounded-full border"
                        style={{
                            borderColor: "rgba(15,23,42,0.10)",
                            background: "rgba(255,255,255,0.7)",
                            color: "var(--muted)",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {rightTag}
                    </div>
                ) : null}
            </div>

            {subtitle ? (
                <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                    {subtitle}
                </div>
            ) : null}
        </div>
    );
}

export default function Holder() {
    const { setHandlers, setSoftKeys } = usePhone();

    const [screen, setScreen] = useState(SCREENS.MAIN);
    const [idx, setIdx] = useState(0);

    const [inv, setInv] = useState("");
    const invRef = useRef("");
    useEffect(() => {
        invRef.current = inv;
    }, [inv]);

    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const [connectionId, setConnectionId] = useState("");

    const [creds, setCreds] = useState([]);
    const [proofReqs, setProofReqs] = useState([]);
    const [selectedCredId, setSelectedCredId] = useState("");

    const [pin, setPin] = useState("");
    const pinRef = useRef("");
    useEffect(() => {
        pinRef.current = pin;
    }, [pin]);

    const [pinError, setPinError] = useState("");
    const [pinCtx, setPinCtx] = useState(null);

    const mainRefs = useRef([]);
    const offerRefs = useRef([]);
    const acceptedRefs = useRef([]);
    const proofRefs = useRef([]);

    const pollRef = useRef(null);

    async function refreshInbox({ quiet = false } = {}) {
        if (!quiet) {
            setBusy(true);
            setMsg("");
        }
        try {
            const [cRes, prRes] = await Promise.all([
                fetch(`${API}/api/credentials`),
                fetch(`${API}/api/proof-requests`),
            ]);

            const c = await cRes.json();
            const pr = await prRes.json();

            if (!cRes.ok) throw new Error(c?.error || "Credentials load failed");
            if (!prRes.ok) throw new Error(pr?.error || "Proof requests load failed");

            const items = c.items || [];
            setCreds(items);
            setProofReqs(pr.items || []);

            if (!selectedCredId) {
                const firstAccepted = items.find((x) => x.status === "accepted");
                if (firstAccepted?._id) setSelectedCredId(firstAccepted._id);
            }
        } catch (e) {
            setMsg(`Error: ${e.message}`);
        } finally {
            if (!quiet) setBusy(false);
        }
    }

    function stopPolling() {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }

    function startSmartPolling() {
        stopPolling();

        let lastOffers = creds.filter((c) => c.status === "offered").length;
        let lastProofs = proofReqs.filter((p) => p.status === "requested").length;
        let attempts = 0;

        pollRef.current = setInterval(async () => {
            attempts += 1;
            await refreshInbox({ quiet: true });

            requestAnimationFrame(() => {
                const o = creds.filter((c) => c.status === "offered").length;
                const p = proofReqs.filter((x) => x.status === "requested").length;

                const gotNewOffers = o > lastOffers;
                const gotNewProofs = p > lastProofs;

                lastOffers = o;
                lastProofs = p;

                if (gotNewOffers || gotNewProofs) {
                    stopPolling();
                }
            });

            if (attempts >= 10) stopPolling();
        }, 1000);
    }

    useEffect(() => {
        return () => stopPolling();
    }, []);

    const connect = useCallback(async () => {
        const code = String(invRef.current || "").trim();

        if (!/^\d{4,5}$/.test(code)) {
            setMsg("Invite must be 4–5 digits (numbers only).");
            return;
        }

        setBusy(true);
        setMsg("");
        try {
            const res = await fetch(`${API}/api/holder/receive-invitation`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteCode: code }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Connect failed");

            setConnectionId(data.connectionId);
            setMsg("Connected ✓");
            setInv("");
            setScreen(SCREENS.MAIN);
            setIdx(0);

            startSmartPolling();
        } catch (e) {
            setMsg(`Error: ${e.message}`);
        } finally {
            setBusy(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function acceptCredentialInternal(credentialId) {
        setBusy(true);
        setMsg("");
        try {
            const res = await fetch(`${API}/api/holder/accept-credential`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credentialId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Accept failed");
            setMsg("Credential accepted ✓");
            await refreshInbox();
        } catch (e) {
            setMsg(`Error: ${e.message}`);
        } finally {
            setBusy(false);
        }
    }

    async function rejectCredential(credentialId) {
        setBusy(true);
        setMsg("");
        try {
            const res = await fetch(`${API}/api/holder/reject-credential`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credentialId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Reject failed");
            setMsg("Credential rejected ✗");
            await refreshInbox();
        } catch (e) {
            setMsg(`Error: ${e.message}`);
        } finally {
            setBusy(false);
        }
    }

    async function presentProofInternal(proofRequestId) {
        if (!selectedCredId) {
            setMsg("Select an accepted credential first.");
            return;
        }

        setBusy(true);
        setMsg("");
        try {
            const res = await fetch(`${API}/api/holder/present-proof`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proofRequestId, credentialId: selectedCredId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Present proof failed");
            setMsg(`Presented ✓  verified: ${data.verified}`);

            startSmartPolling();
            await refreshInbox();
        } catch (e) {
            setMsg(`Error: ${e.message}`);
        } finally {
            setBusy(false);
        }
    }

    async function declineProof(proofRequestId) {
        setBusy(true);
        setMsg("");
        try {
            const res = await fetch(`${API}/api/holder/decline-proof-request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proofRequestId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Decline failed");
            setMsg("Proof request declined ✗");
            await refreshInbox();
        } catch (e) {
            setMsg(`Error: ${e.message}`);
        } finally {
            setBusy(false);
        }
    }

    function requestPin(next) {
        setPin("");
        setPinError("");
        setPinCtx(next);
        setScreen(SCREENS.PIN);
    }

    async function handlePinOk() {
        const v = String(pinRef.current || "");
        if (v !== STATIC_PIN) {
            setPinError("Invalid PIN");
            return;
        }

        const ctx = pinCtx;
        setPinCtx(null);
        setPin("");
        setPinError("");

        if (!ctx) {
            setScreen(SCREENS.MAIN);
            return;
        }

        if (ctx.kind === "accept") {
            setScreen(SCREENS.OFFERS);
            if (ctx.credentialId) await acceptCredentialInternal(ctx.credentialId);
            return;
        }

        if (ctx.kind === "present") {
            setScreen(SCREENS.PROOFS);
            if (ctx.proofRequestId) await presentProofInternal(ctx.proofRequestId);
            return;
        }

        setScreen(SCREENS.MAIN);
    }

    const offered = useMemo(() => creds.filter((c) => c.status === "offered"), [creds]);
    const accepted = useMemo(() => creds.filter((c) => c.status === "accepted"), [creds]);
    const requestedProofs = useMemo(() => proofReqs.filter((p) => p.status === "requested"), [proofReqs]);

    useEffect(() => {
        const len =
            screen === SCREENS.MAIN
                ? 4
                : screen === SCREENS.OFFERS
                    ? offered.length
                    : screen === SCREENS.ACCEPTED
                        ? accepted.length
                        : screen === SCREENS.PROOFS
                            ? requestedProofs.length
                            : 0;

        if (len <= 0) {
            setIdx(0);
            return;
        }
        setIdx((v) => Math.min(v, len - 1));
    }, [screen, offered.length, accepted.length, requestedProofs.length]);

    useEffect(() => {
        const map = {
            [SCREENS.MAIN]: mainRefs,
            [SCREENS.OFFERS]: offerRefs,
            [SCREENS.ACCEPTED]: acceptedRefs,
            [SCREENS.PROOFS]: proofRefs,
        };
        const grp = map[screen];
        if (!grp) return;
        const el = grp.current[idx];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [idx, screen]);

    useEffect(() => {
        mainRefs.current = [];
        offerRefs.current = [];
        acceptedRefs.current = [];
        proofRefs.current = [];

        if (screen === SCREENS.PIN) {
            setSoftKeys({ left: "Clear", center: "OK", right: "Del" });

            setHandlers({
                onDigit: (d) => {
                    if (!/^\d$/.test(String(d))) return;
                    setPin((s) => (s.length < 6 ? s + String(d) : s));
                },
                onBackspace: () => setPin((s) => s.slice(0, -1)),
                onClear: () => setPin(""),
                onOk: () => handlePinOk(),
                onCall: () => handlePinOk(),
                onLeftSoft: () => setPin(""),
                onRightSoft: () => setPin((s) => s.slice(0, -1)),
                onBack: () => {
                    setPin("");
                    setPinError("");
                    setPinCtx(null);
                    setScreen(SCREENS.MAIN);
                },
            });

            return;
        }

        if (screen === SCREENS.MAIN) {
            setSoftKeys({ left: "Refresh", center: "OK", right: "Back" });

            setHandlers({
                onUp: () => setIdx((v) => (v - 1 + 4) % 4),
                onDown: () => setIdx((v) => (v + 1) % 4),

                onDigit: (d) => {
                    if (d === "1") setScreen(SCREENS.ENTER);
                    if (d === "2") {
                        setScreen(SCREENS.OFFERS);
                        startSmartPolling();
                    }
                    if (d === "3") setScreen(SCREENS.ACCEPTED);
                    if (d === "4") {
                        setScreen(SCREENS.PROOFS);
                        startSmartPolling();
                    }
                },

                onOk: () => {
                    if (idx === 0) return setScreen(SCREENS.ENTER);
                    if (idx === 1) {
                        setScreen(SCREENS.OFFERS);
                        startSmartPolling();
                        return;
                    }
                    if (idx === 2) return setScreen(SCREENS.ACCEPTED);
                    if (idx === 3) {
                        setScreen(SCREENS.PROOFS);
                        startSmartPolling();
                    }
                },

                onLeftSoft: () => refreshInbox(),
            });

            return;
        }

        if (screen === SCREENS.ENTER) {
            setSoftKeys({ left: "Clear", center: "Connect", right: "Back" });

            setHandlers({
                onDigit: (d) => {
                    if (!/^\d$/.test(String(d))) return;
                    setInv((s) => (s.length < 5 ? s + String(d) : s));
                },
                onBackspace: () => setInv((s) => s.slice(0, -1)),
                onClear: () => setInv(""),
                onOk: () => connect(),
                onCall: () => connect(),
                onLeftSoft: () => setInv(""),
                onRightSoft: () => setScreen(SCREENS.MAIN),
                onBack: () => setScreen(SCREENS.MAIN),
            });

            return;
        }

        if (screen === SCREENS.OFFERS) {
            setSoftKeys({ left: "Main", center: "OK", right: "Back" });

            setHandlers({
                onUp: () => setIdx((v) => (offered.length ? (v - 1 + offered.length) % offered.length : 0)),
                onDown: () => setIdx((v) => (offered.length ? (v + 1) % offered.length : 0)),

                onOk: () => {
                    const c = offered[idx];
                    if (c?._id) requestPin({ kind: "accept", credentialId: c._id });
                },

                onDigit: (d) => {
                    const c = offered[idx];
                    if (d === "1" && c?._id) requestPin({ kind: "accept", credentialId: c._id });
                    if (d === "2" && c?._id) rejectCredential(c._id);
                    if (d === "3") setScreen(SCREENS.MAIN);
                },

                onLeftSoft: () => setScreen(SCREENS.MAIN),
                onRightSoft: () => setScreen(SCREENS.MAIN),
                onBack: () => setScreen(SCREENS.MAIN),
            });

            return;
        }

        if (screen === SCREENS.ACCEPTED) {
            setSoftKeys({ left: "Main", center: "Select", right: "Back" });

            setHandlers({
                onUp: () => setIdx((v) => (accepted.length ? (v - 1 + accepted.length) % accepted.length : 0)),
                onDown: () => setIdx((v) => (accepted.length ? (v + 1) % accepted.length : 0)),

                onOk: () => {
                    const c = accepted[idx];
                    if (c?._id) {
                        setSelectedCredId(c._id);
                        setMsg(`Selected ✓  ${(c.type || "Credential").toString()}`);
                    }
                },

                onDigit: (d) => {
                    const n = parseInt(d, 10);
                    if (!Number.isNaN(n) && n >= 1 && n <= Math.min(9, accepted.length)) {
                        setIdx(n - 1);
                    }
                },

                onLeftSoft: () => setScreen(SCREENS.MAIN),
                onRightSoft: () => setScreen(SCREENS.MAIN),
                onBack: () => setScreen(SCREENS.MAIN),
            });

            return;
        }

        if (screen === SCREENS.PROOFS) {
            setSoftKeys({ left: "Main", center: "OK", right: "Back" });

            setHandlers({
                onUp: () => setIdx((v) => (requestedProofs.length ? (v - 1 + requestedProofs.length) % requestedProofs.length : 0)),
                onDown: () => setIdx((v) => (requestedProofs.length ? (v + 1) % requestedProofs.length : 0)),

                onOk: () => {
                    const p = requestedProofs[idx];
                    if (p?._id) requestPin({ kind: "present", proofRequestId: p._id });
                },

                onDigit: (d) => {
                    const p = requestedProofs[idx];
                    if (d === "1" && p?._id) requestPin({ kind: "present", proofRequestId: p._id });
                    if (d === "2" && p?._id) declineProof(p._id);
                    if (d === "3") setScreen(SCREENS.MAIN);
                },

                onLeftSoft: () => setScreen(SCREENS.MAIN),
                onRightSoft: () => setScreen(SCREENS.MAIN),
                onBack: () => setScreen(SCREENS.MAIN),
            });

            return;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen, idx, offered, accepted, requestedProofs, setHandlers, setSoftKeys, connect]);

    useEffect(() => {
        refreshInbox();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pinTitle = pinCtx?.kind === "accept" ? "PIN Required (Accept)" : pinCtx?.kind === "present" ? "PIN Required (Send)" : "PIN Required";
    const pinHint = pinCtx?.kind === "accept" ? "Enter PIN to accept credential" : pinCtx?.kind === "present" ? "Enter PIN to send credential" : "Enter PIN";
    const pinMask = pin.length ? "•".repeat(pin.length) : "_____";

    return (
        <div className="p-3">
            <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                Holder
            </div>

            {connectionId ? (
                <div
                    className="mt-2 rounded-xl border px-3 py-2 text-[11px]"
                    style={{
                        borderColor: "rgba(16,185,129,0.35)",
                        background: "var(--good-weak)",
                        color: "var(--text)",
                    }}
                >
                    Connected ✓{" "}
                    <span style={{ color: "var(--muted)" }}>
                        ({String(connectionId).slice(0, 14)}…)
                    </span>
                </div>
            ) : null}

            {screen === SCREENS.PIN ? (
                <Panel title={pinTitle} hint={pinHint}>
                    <div
                        className="rounded-2xl border px-4 py-4"
                        style={{ borderColor: "var(--line)", background: "rgba(255,255,255,0.92)" }}
                    >
                        <div className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                            PIN
                        </div>
                        <div className="mt-1 text-[20px] font-mono tracking-widest" style={{ color: "var(--text)" }}>
                            {pinMask}
                        </div>
                        <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                            DEL=backspace • CLR=clear • OK/CALL=confirm
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
                </Panel>
            ) : null}

            {screen === SCREENS.MAIN ? (
                <Panel title="Holder Menu" hint="▲▼ move • OK open • 1–4 jump">
                    <div className="max-h-60 overflow-y-auto pr-1">
                        {[
                            "1. Enter Invite Code",
                            `2. Offered Credentials`,
                            `3. Accepted Credentials`,
                            `4. Proof Requests`,
                        ].map((t, i) => (
                            <CardRow
                                key={t}
                                innerRef={(el) => (mainRefs.current[i] = el)}
                                active={i === idx}
                                title={t}
                                subtitle={i === 1 ? "Open to accept/reject offers" : ""}
                                tone={i === 1 ? "warn" : "accent"}
                            />
                        ))}
                    </div>
                </Panel>
            ) : null}

            {screen === SCREENS.ENTER ? (
                <Panel title="Enter Invite Code" hint="Digits only • 4–5 digits • OK/CALL to connect">
                    <div
                        className="rounded-2xl border px-4 py-4"
                        style={{ borderColor: "var(--line)", background: "rgba(255,255,255,0.92)" }}
                    >
                        <div className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                            Code
                        </div>
                        <div className="mt-1 text-[20px] font-mono tracking-widest" style={{ color: "var(--text)" }}>
                            {inv || "_____"}
                        </div>
                        <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                            DEL=backspace • CLR=clear • OK/CALL=connect
                        </div>
                    </div>
                </Panel>
            ) : null}

            {screen === SCREENS.OFFERS ? (
                <Panel title="Offered Credentials" hint="OK/1=Accept • 2=Reject • 3=Main • ▲▼ browse">
                    {offered.length === 0 ? (
                        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                            No offered credentials yet.
                        </div>
                    ) : (
                        <div className="max-h-60 overflow-y-auto pr-1">
                            {offered.map((c, i) => (
                                <CardRow
                                    key={c._id}
                                    innerRef={(el) => (offerRefs.current[i] = el)}
                                    active={i === idx}
                                    tone="warn"
                                    title={`${i + 1}. ${(c.type || "Credential").toString()}`}
                                    subtitle={`status: ${c.status}`}
                                    rightTag={i === idx ? "1 Accept • 2 Reject" : ""}
                                />
                            ))}
                        </div>
                    )}
                </Panel>
            ) : null}

            {screen === SCREENS.ACCEPTED ? (
                <Panel title="Accepted Credentials" hint="OK=Select for proof • 1–9 jump • ▲▼ browse">
                    {accepted.length === 0 ? (
                        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                            No accepted credentials yet.
                        </div>
                    ) : (
                        <div className="max-h-60 overflow-y-auto pr-1">
                            {accepted.map((c, i) => (
                                <CardRow
                                    key={c._id}
                                    innerRef={(el) => (acceptedRefs.current[i] = el)}
                                    active={i === idx}
                                    tone="good"
                                    title={`${i + 1}. ${(c.type || "Credential").toString()}${c._id === selectedCredId ? " ✓" : ""}`}
                                    subtitle={`status: ${c.status}`}
                                />
                            ))}
                        </div>
                    )}
                </Panel>
            ) : null}

            {screen === SCREENS.PROOFS ? (
                <Panel title="Proof Requests" hint="OK/1=Send • 2=Don't send • 3=Main • ▲▼ browse">
                    {!selectedCredId ? (
                        <div
                            className="mb-2 rounded-xl border px-3 py-2 text-[11px]"
                            style={{
                                borderColor: "rgba(245,158,11,0.35)",
                                background: "#fffbeb",
                                color: "var(--text)",
                            }}
                        >
                            Select an accepted credential first (Menu → Accepted Credentials).
                        </div>
                    ) : null}

                    {requestedProofs.length === 0 ? (
                        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                            No proof requests yet.
                        </div>
                    ) : (
                        <div className="max-h-60 overflow-y-auto pr-1">
                            {requestedProofs.map((p, i) => (
                                <CardRow
                                    key={p._id}
                                    innerRef={(el) => (proofRefs.current[i] = el)}
                                    active={i === idx}
                                    tone="accent"
                                    title={`${i + 1}. Proof (${String(p._id).slice(0, 6)}…)`}
                                    subtitle={`status: ${p.status}`}
                                    rightTag={i === idx ? "1 Send • 2 Don't" : ""}
                                />
                            ))}
                        </div>
                    )}
                </Panel>
            ) : null}

            {busy ? (
                <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                    Working…
                </div>
            ) : null}

            {msg ? (
                <pre
                    className="mt-3 text-[11px] whitespace-pre-wrap rounded-2xl border px-3 py-2"
                    style={{
                        borderColor: msg.startsWith("Error:") ? "rgba(251,113,133,0.45)" : "var(--line)",
                        background: msg.startsWith("Error:") ? "var(--bad-weak)" : "rgba(255,255,255,0.90)",
                        color: "var(--text)",
                    }}
                >
                    {msg}
                </pre>
            ) : null}
        </div>
    );
}