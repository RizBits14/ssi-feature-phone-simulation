import React, { useEffect, useMemo, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import Navbar from "../Components/Navbar";
import SoftKeys from "../Components/Softkeys";
import Keypad from "../Components/Keypad";
import UssdGate from "../Components/UssdGate";
import { PhoneProvider, usePhone } from "../Phone/PhoneContext";

function Shell() {
    const location = useLocation();
    const navigate = useNavigate();
    const { setGlobalHandlers, setSoftKeys } = usePhone();
    const scrollRef = useRef(null);

    useEffect(() => {
        setGlobalHandlers({
            onEnd: () => navigate("/"),
            onBack: () => navigate(-1),
            onUp: () => scrollRef.current?.scrollBy({ top: -42, behavior: "smooth" }),
            onDown: () => scrollRef.current?.scrollBy({ top: 42, behavior: "smooth" }),
        });

        setSoftKeys({ left: "Menu", center: "OK", right: "Back" });
    }, [navigate, setGlobalHandlers, setSoftKeys]);

    const title = useMemo(() => {
        if (location.pathname === "/") return "Main Menu";
        if (location.pathname.startsWith("/holder")) return "Holder";
        if (location.pathname.startsWith("/wallet")) return "Wallet";
        return "SSI SIM";
    }, [location.pathname]);

    return (
        <div className="min-h-svh w-full flex items-center justify-center p-2 sm:p-4">
            <div
                className="
          w-90 max-w-[92vw]
          rounded-[36px]
          border
          shadow-[0_22px_60px_rgba(15,23,42,0.18)]
          overflow-hidden
        "
                style={{
                    background: "var(--phone-body)",
                    borderColor: "var(--phone-edge)",
                }}
            >
                <div className="h-6 sm:h-7 flex items-center justify-center">
                    <div
                        className="h-2 w-24 rounded-full"
                        style={{ background: "rgba(15,23,42,0.12)" }}
                    />
                </div>

                <Navbar title={title} />

                <div className="px-3 mt-2">
                    <div
                        className="rounded-[22px] border overflow-hidden"
                        style={{ background: "var(--screen-bg)", borderColor: "var(--line)" }}
                    >
                        <div className="h-72 sm:h-80 flex flex-col">
                            <div
                                ref={scrollRef}
                                className="flex-1 overflow-auto"
                                style={{ background: "linear-gradient(180deg, var(--screen-bg), var(--screen-tint))" }}
                            >
                                <UssdGate>
                                    <Outlet />
                                </UssdGate>
                            </div>

                            <div className="pb-2">
                                <SoftKeys />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-2 sm:mt-3">
                    <Keypad />
                </div>
            </div>
        </div>
    );
}

export default function RootLayouts() {
    return (
        <PhoneProvider>
            <Shell />
        </PhoneProvider>
    );
}