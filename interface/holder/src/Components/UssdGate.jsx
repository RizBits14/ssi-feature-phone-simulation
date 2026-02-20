import { useState } from "react";
import UssdPage from "../Pages/Ussd";

const STATIC_USSD = "*567#";

export default function UssdGate({ children }) {
    const [entered, setEntered] = useState(false);
    const [error, setError] = useState("");

    if (!entered) {
        return (
            <UssdPage
                onSubmit={(v) => {
                    if (v === STATIC_USSD) {
                        setError("");
                        setEntered(true);
                    } else {
                        setError("Invalid USSD code");
                    }
                }}
                error={error}
            />
        );
    }

    return children;
}