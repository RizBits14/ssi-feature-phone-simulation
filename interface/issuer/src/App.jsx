import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FiCopy, FiRefreshCcw, FiSend, FiServer, FiCheckCircle, FiAlertTriangle, FiLink2, FiFileText, FiUser, FiHash, FiPhone, FiTag } from "react-icons/fi";
import ecLogo from "./assets/logo.png";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    void e;
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (e2) {
      void e2;
      return false;
    }
  }
}

function maskId(id) {
  if (!id) return "—";
  const s = String(id);
  if (s.length <= 12) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

export default function App() {
  const API = import.meta.env.VITE_API_BASE || "http://localhost:3000";
  const http = useMemo(() => axios.create({ baseURL: API }), [API]);

  const [inviteCode, setInviteCode] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [status, setStatus] = useState("idle");
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const [offered, setOffered] = useState(false);
  const [credentialId, setCredentialId] = useState("");
  const [offerDecision, setOfferDecision] = useState("idle");

  const [claims, setClaims] = useState({
    name: "Ari",
    numeric: "12345",
    phone: "+8801XXXXXXXXX",
    department: "NID",
  });

  const [busyCode, setBusyCode] = useState(false);
  const [busySend, setBusySend] = useState(false);

  const pollRef = useRef(null);
  const offerPollRef = useRef(null);
  const toastTimerRef = useRef(null);

  const pushToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 1800);
  }, []);

  function setField(k, v) {
    setClaims((p) => ({ ...p, [k]: v, department: "NID" }));
  }

  const connected = status === "connected";

  const decisionTone =
    offerDecision === "accepted"
      ? "success"
      : offerDecision === "rejected"
        ? "error"
        : offerDecision === "pending"
          ? "warning"
          : offered
            ? "info"
            : connected
              ? "success"
              : status === "code-created"
                ? "warning"
                : "neutral";

  const statusBadge =
    decisionTone === "success"
      ? "badge-success"
      : decisionTone === "error"
        ? "badge-error"
        : decisionTone === "warning"
          ? "badge-warning"
          : decisionTone === "info"
            ? "badge-info"
            : "badge-ghost";

  const stepIndex = offered ? 3 : connected ? 2 : status === "code-created" ? 1 : 0;
  const stepProgress = stepIndex === 0 ? 14 : stepIndex === 1 ? 38 : stepIndex === 2 ? 74 : 100;

  function stepClass(i) {
    if (offered) return "step-success";
    if (i < stepIndex) return "step-success";
    if (i === stepIndex) return "step-secondary";
    return "";
  }

  function phaseLabel() {
    if (offerDecision === "accepted") return "Accepted";
    if (offerDecision === "rejected") return "Rejected";
    if (offerDecision === "pending") return "Pending";
    if (offered) return "Offered";
    if (connected) return "Connected";
    if (status === "code-created") return "Waiting";
    return "Idle";
  }

  async function healthCheck() {
    setErr("");
    try {
      await http.get("/api/health");
      pushToast("Backend is reachable ✅");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  }

  function hardResetLocal() {
    setErr("");
    setInviteCode("");
    setConnectionId("");
    setStatus("idle");
    setOffered(false);
    setCredentialId("");
    setOfferDecision("idle");
    setClaims((p) => ({ ...p, department: "NID" }));
  }

  function resetAll() {
    hardResetLocal();
    pushToast("Reset done");
  }

  async function createCode() {
    setErr("");
    setInviteCode("");
    setConnectionId("");
    setStatus("idle");
    setOffered(false);
    setCredentialId("");
    setOfferDecision("idle");
    setClaims((p) => ({ ...p, department: "NID" }));
    setBusyCode(true);

    try {
      const res = await http.post("/api/issuer/create-invitation", {
        label: "holder",
        alias: "holder",
      });
      setInviteCode(res.data.inviteCode);
      setStatus("code-created");
      pushToast("Invite code generated");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusyCode(false);
    }
  }

  const checkConnected = useCallback(
    async (code) => {
      const res = await http.get("/api/connections");
      const items = res.data?.items || [];
      const row = items.find((x) => String(x.inviteCode) === String(code));

      if (row?.status === "connected" && row?.connectionId) {
        setConnectionId(row.connectionId);
        setStatus("connected");
        return true;
      }
      return false;
    },
    [http]
  );

  useEffect(() => {
    if (!inviteCode || status !== "code-created") return;

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const done = await checkConnected(inviteCode);
        if (done) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          pushToast("Holder connected 🎉");
        }
      } catch (e) {
        void e;
      }
    }, 900);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [inviteCode, status, checkConnected, pushToast]);

  useEffect(() => {
    if (!connected) {
      setOffered(false);
      setCredentialId("");
      setOfferDecision("idle");
    }
  }, [connected]);

  async function sendCredential() {
    setErr("");
    setBusySend(true);

    try {
      if (!connectionId) throw new Error("No connectionId yet. Wait for holder to connect.");

      const res = await http.post("/api/issuer/issue-credential", {
        connectionId,
        claims: { ...claims, department: "NID" },
      });

      const id = String(res.data?.credentialId || "");
      setCredentialId(id);
      setOffered(true);
      setOfferDecision("pending");
      pushToast(`NID credential offered ✅ (${id ? id.slice(-6) : "ok"})`);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusySend(false);
    }
  }

  const checkOfferDecision = useCallback(
    async (cid) => {
      const paths = [
        "/api/credentials",
        "/api/issuer/credentials",
        "/api/credential-offers",
        "/api/issuer/credential-offers",
      ];

      for (const p of paths) {
        try {
          const res = await http.get(p);
          const items = res.data?.items || res.data?.credentials || res.data || [];
          const list = Array.isArray(items) ? items : [];
          const hit = list.find((x) => String(x?._id || x?.credentialId || x?.id || "") === String(cid));
          if (!hit) continue;

          const st = String(hit?.status || hit?.state || hit?.decision || "").toLowerCase();

          if (st.includes("accept") || st === "accepted") return "accepted";
          if (st.includes("reject") || st.includes("declin") || st === "rejected" || st === "declined")
            return "rejected";

          return "pending";
        } catch (e) {
          void e;
        }
      }

      return "pending";
    },
    [http]
  );

  useEffect(() => {
    if (!credentialId || offerDecision !== "pending") return;

    if (offerPollRef.current) clearInterval(offerPollRef.current);
    offerPollRef.current = setInterval(async () => {
      try {
        const d = await checkOfferDecision(credentialId);
        if (d === "accepted" || d === "rejected") {
          setOfferDecision(d);
          clearInterval(offerPollRef.current);
          offerPollRef.current = null;
          pushToast(d === "accepted" ? "Holder accepted ✅" : "Holder rejected ❌");
        }
      } catch (e) {
        void e;
      }
    }, 900);

    return () => {
      if (offerPollRef.current) clearInterval(offerPollRef.current);
      offerPollRef.current = null;
    };
  }, [credentialId, offerDecision, checkOfferDecision, pushToast]);

  const decisionBadge =
    offerDecision === "accepted" ? (
      <div className="badge badge-success gap-2 px-4 py-3 leading-none font-medium">
        <FiCheckCircle /> Accepted
      </div>
    ) : offerDecision === "rejected" ? (
      <div className="badge badge-error gap-2 px-4 py-3 leading-none font-medium">
        <FiAlertTriangle /> Rejected
      </div>
    ) : offerDecision === "pending" ? (
      <div className="badge badge-warning gap-2 px-4 py-3 leading-none font-medium">
        <span className="loading loading-spinner" /> Pending
      </div>
    ) : offered ? (
      <div className="badge badge-info gap-2 px-4 py-3 leading-none font-medium">
        <FiCheckCircle /> Offered
      </div>
    ) : connected ? (
      <div className="badge badge-success gap-2 px-4 py-3 leading-none font-medium">
        <FiCheckCircle /> Ready
      </div>
    ) : (
      <div className="badge badge-outline gap-2 px-4 py-3 leading-none font-medium">
        <FiAlertTriangle /> Connect first
      </div>
    );

  const progressLabel =
    offerDecision === "accepted"
      ? "NID credential accepted by holder"
      : offerDecision === "rejected"
        ? "NID credential rejected by holder"
        : offerDecision === "pending"
          ? "Awaiting holder decision for NID credential"
          : offered
            ? "NID credential offered successfully"
            : connected
              ? "Ready to issue NID credential"
              : status === "code-created"
                ? "Waiting for holder connection"
                : "Generate an invitation code to begin";

  const progressVariant =
    offerDecision === "accepted"
      ? "progress-success"
      : offerDecision === "rejected"
        ? "progress-error"
        : offerDecision === "pending"
          ? "progress-warning"
          : offered
            ? "progress-info"
            : connected
              ? "progress-info"
              : status === "code-created"
                ? "progress-warning"
                : "progress-secondary";

  return (
    <div data-theme="light" className="min-h-screen bg-base-200">
      <div className="sticky top-0 z-20 border-b border-base-300/60 bg-base-100/92 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                <div className="grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-2xl border border-base-300/60 bg-base-100 shadow-sm">
                  <img
                    src={ecLogo}
                    alt="Bangladesh Election Commission (EC) Logo"
                    className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-sm sm:text-base font-semibold leading-tight">
                    Bangladesh Election Commission (EC)
                  </div>
                  <span className="badge badge-outline px-3 py-2 text-[11px] font-medium">
                    Research Prototype
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] sm:text-xs opacity-70">
                  NID Credential Issuance Console (Issuer Simulation)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              <button className="btn btn-ghost btn-sm gap-2 flex-1 sm:flex-none" onClick={healthCheck}>
                <FiServer /> Health
              </button>
              <button className="btn btn-ghost btn-sm gap-2 flex-1 sm:flex-none" onClick={resetAll}>
                <FiRefreshCcw /> Reset
              </button>
            </div>
          </div>
        </div>

        <div className="h-0.75 w-full bg-primary/70" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="card border border-base-300/60 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-base-300/60 bg-base-100 shadow-sm">
                  <FiLink2 className="text-base text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs opacity-70">Operational status</div>
                  <div className="mt-0.5 text-sm font-semibold">{progressLabel}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className={cls("badge px-4 py-3 leading-none font-medium", statusBadge)}>{phaseLabel()}</div>
                <div className="badge badge-outline px-4 py-3 leading-none">
                  <span className="font-mono text-xs">conn: {maskId(connectionId)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <ul className="steps steps-vertical lg:steps-horizontal">
                <li className={cls("step", stepClass(0))}>
                  <span className="font-medium">Generate code</span>
                </li>
                <li className={cls("step", stepClass(1))}>
                  <span className="font-medium">Holder connects</span>
                </li>
                <li className={cls("step", stepClass(2))}>
                  <span className="font-medium">Issue NID</span>
                </li>
                <li className={cls("step", stepClass(3))}>
                  <span className="font-medium">Offer status</span>
                </li>
              </ul>

              <div className="rounded-2xl border border-base-300/60 bg-base-200/70 p-3">
                <div className="flex items-center justify-between text-xs opacity-70">
                  <span>Workflow</span>
                  <span>{stepIndex + 1}/4</span>
                </div>
                <progress className={cls("progress mt-2 w-full", progressVariant)} value={stepProgress} max="100" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-base-300/60 bg-base-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <FiHash className="text-primary" /> connectionId
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="rounded-lg border border-base-300/60 bg-base-200/60 px-2 py-1 text-xs font-mono">
                        {maskId(connectionId)}
                      </code>
                      <button
                        className="btn btn-ghost btn-xs"
                        disabled={!connectionId}
                        onClick={async () => {
                          const ok = await copyText(connectionId);
                          pushToast(ok ? "connectionId copied" : "Copy failed");
                        }}
                      >
                        <FiCopy />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs opacity-70">Auto-filled after holder connects.</div>
                </div>

                <div className="rounded-2xl border border-base-300/60 bg-base-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <FiFileText className="text-primary" /> credentialId
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="rounded-lg border border-base-300/60 bg-base-200/60 px-2 py-1 text-xs font-mono">
                        {maskId(credentialId)}
                      </code>
                      <button
                        className="btn btn-ghost btn-xs"
                        disabled={!credentialId}
                        onClick={async () => {
                          const ok = await copyText(credentialId);
                          pushToast(ok ? "credentialId copied" : "Copy failed");
                        }}
                      >
                        <FiCopy />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs opacity-70">
                    {offerDecision === "pending"
                      ? "Polling for holder decision…"
                      : offerDecision === "accepted"
                        ? "Holder accepted."
                        : offerDecision === "rejected"
                          ? "Holder rejected."
                          : "Shown after you offer an NID credential."}
                  </div>
                </div>
              </div>

              {offerDecision === "pending" && credentialId && (
                <div className="alert border border-base-300/60 bg-base-100 shadow-sm">
                  <span className="loading loading-spinner" />
                  <span className="font-medium">Waiting for holder to accept or reject…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-2">
        <div className="card border border-base-300/60 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="card-title flex items-center gap-2">
                  <FiLink2 className="text-primary" /> Connection Setup
                </h2>
                <p className="mt-1 text-sm opacity-70">Generate a 5-digit code for the holder device to connect.</p>
              </div>
              <div className={cls("badge px-4 py-3 leading-none font-medium", statusBadge)}>{phaseLabel()}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className={cls("btn btn-primary gap-2", busyCode && "btn-disabled")} onClick={createCode}>
                {busyCode ? <span className="loading loading-spinner" /> : null}
                Generate code
              </button>

              {inviteCode ? (
                <div className="rounded-2xl border border-base-300/60 bg-base-200/60 px-5 py-2">
                  <div className="text-[11px] font-medium opacity-70">Invitation code</div>
                  <div className="mt-0.5 font-mono text-2xl font-semibold tracking-widest text-base-content">
                    {inviteCode}
                  </div>
                </div>
              ) : (
                <div className="badge badge-outline px-4 py-3 leading-none opacity-70">No code yet</div>
              )}
            </div>

            {status === "code-created" && (
              <div className="alert border border-base-300/60 bg-base-100 shadow-sm">
                <span className="loading loading-spinner" />
                <span className="font-medium">Waiting for holder to connect…</span>
              </div>
            )}
          </div>
        </div>

        <div className="card border border-base-300/60 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="card-title flex items-center gap-2">
                  <FiFileText className="text-primary" /> NID Credential Issuance
                </h2>
              </div>
              {decisionBadge}
            </div>

            <div className="rounded-2xl border border-base-300/60 bg-base-200/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-primary gap-1 px-4 py-3 leading-none font-medium">
                    <FiTag /> National ID (NID)
                  </span>
                  {offerDecision === "accepted" && (
                    <span className="badge badge-success px-4 py-3 leading-none font-medium">Accepted</span>
                  )}
                  {offerDecision === "rejected" && (
                    <span className="badge badge-error px-4 py-3 leading-none font-medium">Rejected</span>
                  )}
                  {offerDecision === "pending" && (
                    <span className="badge badge-warning px-4 py-3 leading-none font-medium">
                      <span className="loading loading-spinner" /> Pending
                    </span>
                  )}
                  {offerDecision === "idle" && offered && (
                    <span className="badge badge-info px-4 py-3 leading-none font-medium">Offered</span>
                  )}
                </div>

                <button
                  className="btn btn-ghost btn-sm gap-2"
                  onClick={async () => {
                    const text =
                      `type: NID\n` +
                      `name: ${claims.name || "-"}\n` +
                      `numeric: ${claims.numeric || "-"}\n` +
                      `phone: ${claims.phone || "-"}`;
                    const ok = await copyText(text);
                    pushToast(ok ? "Copied preview" : "Copy failed");
                  }}
                >
                  <FiCopy /> Copy
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                <div className="flex items-center justify-between rounded-2xl border border-base-300/60 bg-base-100 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FiUser className="text-primary" /> Name
                  </div>
                  <div className="text-sm font-semibold">{claims.name || <span className="opacity-60">—</span>}</div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-base-300/60 bg-base-100 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FiHash className="text-primary" /> Numeric ID
                  </div>
                  <div className="text-sm font-semibold">{claims.numeric || <span className="opacity-60">—</span>}</div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-base-300/60 bg-base-100 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FiPhone className="text-primary" /> Phone
                  </div>
                  <div className="text-sm font-semibold">{claims.phone || <span className="opacity-60">—</span>}</div>
                </div>
              </div>

              <div className="mt-3 text-xs opacity-70">
                Credential type is fixed to <span className="font-semibold">NID</span>.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text font-medium">Name</span>
                </div>
                <input
                  className="input input-bordered w-full bg-base-100 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  value={claims.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text font-medium">Numeric ID</span>
                </div>
                <input
                  className="input input-bordered w-full bg-base-100 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  value={claims.numeric}
                  onChange={(e) => setField("numeric", e.target.value)}
                />
              </label>

              <label className="form-control w-full md:col-span-2">
                <div className="label">
                  <span className="label-text font-medium">Phone</span>
                </div>
                <input
                  className="input input-bordered w-full bg-base-100 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  value={claims.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                />
              </label>

              <label className="form-control w-full md:col-span-2">
                <div className="label">
                  <span className="label-text font-medium">Credential Type</span>
                  <span className="label-text-alt opacity-60">(fixed)</span>
                </div>
                <input
                  className="input input-bordered w-full bg-base-100"
                  value="National ID (NID)"
                  readOnly
                />
              </label>
            </div>

            <button
              className={cls("btn gap-2", connected ? "btn-primary" : "btn-disabled", busySend && "btn-disabled")}
              onClick={sendCredential}
            >
              {busySend ? <span className="loading loading-spinner" /> : <FiSend />}
              Issue NID credential
            </button>

            {credentialId && offerDecision !== "idle" && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs opacity-70">
                <span className="badge badge-outline px-4 py-3 leading-none">credential: {maskId(credentialId)}</span>
                {offerDecision === "pending" && (
                  <span className="badge badge-warning px-4 py-3 leading-none">awaiting decision</span>
                )}
                {offerDecision === "accepted" && (
                  <span className="badge badge-success px-4 py-3 leading-none">accepted</span>
                )}
                {offerDecision === "rejected" && (
                  <span className="badge badge-error px-4 py-3 leading-none">rejected</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 grid gap-3">
          {err && (
            <div className="alert border border-error/30 bg-base-100 shadow-sm">
              <FiAlertTriangle />
              <span>{err}</span>
            </div>
          )}
          {toast && (
            <div className="toast toast-end">
              <div className="alert border border-success/25 bg-base-100 shadow-sm">
                <span>{toast}</span>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 text-center text-xs opacity-60">
          © Bangladesh Election Commission (EC) - Simulation interface for research and demonstration
        </div>
      </div>
    </div>
  );
}

