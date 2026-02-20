import React, { useEffect, useRef, useState } from "react";
import { usePhone } from "../Phone/PhoneContext";

export default function Ussd({ onSubmit, error }) {
    const { setHandlers, setSoftKeys } = usePhone();
    const [input, setInput] = useState("");
    const inputRef = useRef(input);
    const onSubmitRef = useRef(onSubmit);

    useEffect(() => {
        inputRef.current = input;
    }, [input]);

    useEffect(() => {
        onSubmitRef.current = onSubmit;
    }, [onSubmit]);

    useEffect(() => {
        setSoftKeys({ left: "Clear", center: "OK", right: "Back" });

        setHandlers({
            onDigit: (d) => setInput((s) => (s.length < 16 ? s + String(d) : s)),
            onStar: () => setInput((s) => (s.length < 16 ? s + "*" : s)),
            onHash: () => setInput((s) => (s.length < 16 ? s + "#" : s)),
            onBackspace: () => setInput((s) => s.slice(0, -1)),
            onOk: () => {
                const value = inputRef.current;
                onSubmitRef.current?.(value);
                setInput("");
            },
            onLeftSoft: () => setInput(""),
            onRightSoft: () => setInput((s) => s.slice(0, -1)),
        });

        return () => {
            setHandlers({});
            setSoftKeys({ left: "Menu", center: "OK", right: "Back" });
        };
    }, [setHandlers, setSoftKeys]);

    return (
        <div className="p-3">
            <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                USSD Login
            </div>
            <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                Type the USSD code using keypad.
            </div>

            <div
                className="mt-3 rounded-2xl border p-3"
                style={{ borderColor: "var(--line)", background: "rgba(255,255,255,0.85)" }}
            >
                <div className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>
                    Dial
                </div>
                <div className="mt-1 text-[16px] font-mono tracking-widest break-all" style={{ color: "var(--text)" }}>
                    {input || "____"}
                </div>
            </div>

            {error ? (
                <div
                    className="mt-2 text-[11px] rounded-xl border px-2 py-2"
                    style={{ borderColor: "rgba(251,113,133,0.45)", background: "var(--bad-weak)", color: "var(--text)" }}
                >
                    {error}
                </div>
            ) : null}
        </div>
    );
}