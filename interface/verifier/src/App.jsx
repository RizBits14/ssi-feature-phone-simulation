import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FiCopy, FiRefreshCcw, FiSend, FiServer, FiCheckCircle, FiAlertTriangle, FiEye, FiLink2, FiShield, FiUser, FiHash } from "react-icons/fi";
import brtaLogo from "./assets/logo.svg";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
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
  const [connStatus, setConnStatus] = useState("idle");

  const [proofRequestId, setProofRequestId] = useState("");
  const [presentation, setPresentation] = useState(null);
  const [proofDecision, setProofDecision] = useState("idle");

  const [busyCode, setBusyCode] = useState(false);
  const [busySend, setBusySend] = useState(false);

  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const pollRef = useRef(null);
  const proofPollRef = useRef(null);

  const pushToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(pushToast._t);
    pushToast._t = window.setTimeout(() => setToast(""), 1800);
  }, []);

  const healthCheck = useCallback(async () => {
    setErr("");
    try {
      await http.get("/api/health");
      pushToast("Backend is reachable ✅");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  }, [http, pushToast]);

  const hardResetLocal = useCallback(() => {
    setErr("");
    setInviteCode("");
    setConnectionId("");
    setConnStatus("idle");
    setProofRequestId("");
    setPresentation(null);
    setProofDecision("idle");
  }, []);

  const resetAll = useCallback(() => {
    hardResetLocal();
    pushToast("Reset done");
  }, [hardResetLocal, pushToast]);

  const generateVerifierCode = useCallback(async () => {
    setErr("");
    setBusyCode(true);

    setInviteCode("");
    setConnectionId("");
    setConnStatus("idle");
    setProofRequestId("");
    setPresentation(null);
    setProofDecision("idle");

    try {
      const res = await http.post("/api/issuer/create-invitation", {
        label: "holder",
        alias: "holder",
      });
      setInviteCode(String(res.data?.inviteCode || ""));
      setConnStatus("waiting");
      pushToast("Verifier code generated");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusyCode(false);
    }
  }, [http, pushToast]);

  const checkConnected = useCallback(
    async (code) => {
      const res = await http.get("/api/connections");
      const items = res.data?.items || [];
      const row = items.find((x) => String(x.inviteCode) === String(code));

      if (row?.status === "connected" && row?.connectionId) {
        setConnectionId(String(row.connectionId));
        setConnStatus("connected");
        return true;
      }
      return false;
    },
    [http]
  );

  useEffect(() => {
    if (!inviteCode || connStatus !== "waiting") return;

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const done = await checkConnected(inviteCode);
        if (done) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          pushToast("Holder connected 🎉");
        }
      } catch {
        return;
      }
    }, 900);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [inviteCode, connStatus, checkConnected, pushToast]);

  const sendProofRequest = useCallback(async () => {
    setErr("");
    setBusySend(true);
    setPresentation(null);
    setProofRequestId("");
    setProofDecision("idle");

    try {
      if (!connectionId) throw new Error("Wait for holder to connect first.");

      const ask = [];

      const res = await http.post("/api/verifier/send-proof-request", {
        connectionId,
        request: { ask, predicates: [] },
      });

      const id = String(res.data?.proofRequestId || "");
      setProofRequestId(id);
      setProofDecision("pending");
      pushToast("Proof request sent ✅");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusySend(false);
    }
  }, [connectionId, http, pushToast]);

  const fetchProofRequestStatus = useCallback(
    async (prId) => {
      const res = await http.get("/api/proof-requests");
      const items = res.data?.items || [];
      const hit = items.find((x) => String(x?._id || x?.id || "") === String(prId));
      if (!hit) return "pending";
      const st = String(hit?.status || hit?.state || hit?.decision || "").toLowerCase();
      if (st.includes("declin") || st.includes("reject") || st === "declined" || st === "rejected") return "declined";
      if (st.includes("present") || st === "presented") return "presented";
      return "pending";
    },
    [http]
  );

  const fetchPresentationByProofRequestId = useCallback(
    async (prId) => {
      const res = await http.get("/api/presentations");
      const items = res.data?.items || [];
      const hit = items.find((x) => String(x?.proofRequestId || "") === String(prId));
      return hit || null;
    },
    [http]
  );

  useEffect(() => {
    if (!proofRequestId || proofDecision !== "pending") return;

    if (proofPollRef.current) clearInterval(proofPollRef.current);

    proofPollRef.current = setInterval(async () => {
      try {
        const st = await fetchProofRequestStatus(proofRequestId);

        if (st === "declined") {
          setPresentation(null);
          setProofDecision("declined");
          if (proofPollRef.current) clearInterval(proofPollRef.current);
          proofPollRef.current = null;
          pushToast("Holder rejected ❌");
          return;
        }

        if (st === "presented") {
          const pres = await fetchPresentationByProofRequestId(proofRequestId);
          if (pres) {
            setPresentation(pres);
            setProofDecision("presented");
            if (proofPollRef.current) clearInterval(proofPollRef.current);
            proofPollRef.current = null;
            pushToast("Presentation received ✅");
          }
        }
      } catch {
        return;
      }
    }, 900);

    return () => {
      if (proofPollRef.current) clearInterval(proofPollRef.current);
      proofPollRef.current = null;
    };
  }, [
    proofRequestId,
    proofDecision,
    fetchProofRequestStatus,
    fetchPresentationByProofRequestId,
    pushToast,
  ]);

  const rejected = proofDecision === "declined";
  const verified = proofDecision === "presented" && !!presentation;

  const badgeConnClass =
    connStatus === "connected"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : connStatus === "waiting"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-50 text-slate-800";

  const stepIndex = verified ? 3 : rejected ? 3 : proofRequestId ? 2 : connStatus === "connected" ? 1 : 0;
  const stepProgress = verified ? 100 : rejected ? 100 : proofRequestId ? 72 : connStatus === "connected" ? 44 : 16;

  function stepClass(i) {
    if (verified) return "step-success";
    if (rejected) return i === 3 ? "step-error" : i < 3 ? "step-success" : "";
    if (i < stepIndex) return "step-success";
    if (i === stepIndex) return "step-secondary";
    return "";
  }

  const revealedName =
    presentation?.revealed?.name ??
    presentation?.revealed?.Name ??
    presentation?.revealed?.fullName ??
    "";

  const revealedNumeric =
    presentation?.revealed?.numeric ??
    presentation?.revealed?.Numerics ??
    presentation?.revealed?.id ??
    "";

  const progressText = verified
    ? "Verified presentation received"
    : rejected
      ? "Holder rejected the proof request"
      : proofDecision === "pending"
        ? "Waiting for holder presentation"
        : connStatus === "connected"
          ? "Ready to send proof request"
          : connStatus === "waiting"
            ? "Waiting for holder to connect"
            : "Start by generating a verifier code";

  const progressBarClass =
    verified
      ? "bg-emerald-600"
      : rejected
        ? "bg-rose-600"
        : proofDecision === "pending"
          ? "bg-sky-700"
          : connStatus === "connected"
            ? "bg-indigo-700"
            : connStatus === "waiting"
              ? "bg-amber-600"
              : "bg-slate-500";

  const primaryBtn =
    "btn border-transparent bg-[#0B3A6A] text-white hover:bg-[#082E55] active:bg-[#072746] disabled:bg-[#0B3A6A]/45 disabled:text-white/80";

  return (
    <div data-theme="light" className="min-h-screen bg-linear-to-br from-[#f8fafc] via-[#f3f6fb] to-[#eef2f8]">
      <div className="sticky top-0 z-20 border-b border-base-300/60 bg-base-100/92 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                <div className="grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-2xl border border-base-300/60 bg-base-100 shadow-sm">
                  <img
                    src={brtaLogo}
                    alt="Bangladesh Road Transport Authority (BRTA) Logo"
                    className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-sm sm:text-base font-semibold leading-tight text-[#0B3A6A]">
                    Bangladesh Road Transport Authority (BRTA)
                  </div>
                  <span className="badge badge-outline px-3 py-2 text-[11px] font-medium">Research Prototype</span>
                  {verified && (
                    <span className="badge border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-800">
                      Verified
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11px] sm:text-xs opacity-70">
                  Proof Request & Verification (Verifier Simulation)
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

        <div className="h-0.75 w-full bg-linear-to-r from-[#0B3A6A] via-[#0F4B84] to-[#C08A1A]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="card border border-base-300/60 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-base-300/60 bg-base-100 shadow-sm">
                  <FiEye className="text-base text-[#0B3A6A]" />
                </div>

                <div className="min-w-0">
                  <div className="text-xs opacity-70">Operational status</div>
                  <div className="mt-0.5 text-sm font-semibold">{progressText}</div>
                  <div className="mt-1 text-xs opacity-70">
                    Authority: <span className="font-medium">BRTA</span> • Mode:{" "}
                    <span className="font-medium">Verification</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={cls("inline-flex items-center rounded-full border px-3 py-2 text-xs font-medium", badgeConnClass)}>
                  {connStatus === "connected" ? "Connected" : connStatus === "waiting" ? "Waiting" : "Idle"}
                </span>
                <span className="inline-flex items-center rounded-full border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-medium">
                  <span className="font-mono">conn: {maskId(connectionId)}</span>
                </span>
                {proofDecision === "pending" && proofRequestId && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
                    <span className="loading loading-spinner" /> Pending
                  </span>
                )}
                {rejected && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                    <FiAlertTriangle /> Rejected
                  </span>
                )}
                {verified && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                    <FiCheckCircle /> Verified
                  </span>
                )}
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
                  <span className="font-medium">Send proof request</span>
                </li>
                <li className={cls("step", stepClass(3))}>
                  <span className="font-medium">{rejected ? "Rejected" : "Verified"}</span>
                </li>
              </ul>

              <div className="rounded-2xl border border-base-300/60 bg-base-200/60 p-3">
                <div className="flex items-center justify-between text-xs opacity-70">
                  <span>Workflow</span>
                  <span>{Math.min(stepIndex + 1, 4)}/4</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className={cls("h-full rounded-full transition-all duration-500", progressBarClass)} style={{ width: `${stepProgress}%` }} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-base-300/60 bg-base-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <FiHash className="text-[#0B3A6A]" /> connectionId
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
                      <FiShield className="text-[#0B3A6A]" /> proofRequestId
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="rounded-lg border border-base-300/60 bg-base-200/60 px-2 py-1 text-xs font-mono">
                        {maskId(proofRequestId)}
                      </code>
                      <button
                        className="btn btn-ghost btn-xs"
                        disabled={!proofRequestId}
                        onClick={async () => {
                          const ok = await copyText(proofRequestId);
                          pushToast(ok ? "proofRequestId copied" : "Copy failed");
                        }}
                      >
                        <FiCopy />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs opacity-70">
                    {proofRequestId
                      ? rejected
                        ? "Holder declined the request."
                        : verified
                          ? "Presentation recorded."
                          : proofDecision === "pending"
                            ? "Waiting for presentation…"
                            : "Requested."
                      : "Shown after you send a request."}
                  </div>
                </div>
              </div>

              {proofRequestId && proofDecision === "pending" && !verified && !rejected && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <FiEye />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">Waiting for holder presentation…</div>
                      <div className="mt-0.5 text-xs opacity-80">
                        proofRequestId:{" "}
                        <code className="rounded border border-sky-200 bg-white/70 px-2 py-1">
                          {maskId(proofRequestId)}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {proofRequestId && rejected && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <FiAlertTriangle />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">Holder declined the proof request.</div>
                      <div className="mt-0.5 text-xs opacity-80">
                        proofRequestId:{" "}
                        <code className="rounded border border-rose-200 bg-white/70 px-2 py-1">
                          {maskId(proofRequestId)}
                        </code>
                      </div>
                    </div>
                  </div>
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
                  <FiLink2 className="text-[#0B3A6A]" /> Connection Setup
                </h2>
                <p className="mt-1 text-sm opacity-70">Generate a verifier code. The holder enters it to connect.</p>
              </div>

              <span className={cls("inline-flex items-center rounded-full border px-3 py-2 text-xs font-medium", badgeConnClass)}>
                {connStatus === "connected" ? "Connected" : connStatus === "waiting" ? "Waiting" : "Idle"}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button className={cls(primaryBtn, busyCode && "btn-disabled")} onClick={generateVerifierCode}>
                {busyCode ? <span className="loading loading-spinner" /> : null}
                Generate code
              </button>

              {inviteCode ? (
                <div className="flex-1 rounded-2xl border border-base-300/60 bg-base-200/60 px-5 py-2">
                  <div className="text-[11px] font-medium opacity-70">Verifier code</div>
                  <div className="mt-0.5 font-mono text-2xl font-semibold tracking-widest text-base-content">
                    {inviteCode}
                  </div>
                </div>
              ) : (
                <div className="badge badge-outline px-4 py-3 leading-none opacity-70">No code yet</div>
              )}
            </div>

            {connStatus === "waiting" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="loading loading-spinner" />
                  <span className="font-medium">Waiting for holder to connect…</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card border border-base-300/60 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="card-title flex items-center gap-2">
                  <FiShield className="text-[#0B3A6A]" /> Proof Request
                </h2>
                <p className="mt-1 text-sm opacity-70">Send a verification request and receive a presentation.</p>
              </div>

              {rejected ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                  <FiAlertTriangle /> Rejected
                </span>
              ) : verified ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  <FiCheckCircle /> Verified
                </span>
              ) : connStatus === "connected" ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  <FiCheckCircle /> Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800">
                  <FiAlertTriangle /> Connect first
                </span>
              )}
            </div>

            <button
              className={cls(primaryBtn, (connStatus !== "connected" || busySend) && "btn-disabled")}
              onClick={sendProofRequest}
            >
              {busySend ? <span className="loading loading-spinner" /> : <FiSend />}
              Send proof request
            </button>

            {verified && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-2 text-xs font-medium text-white">
                        <FiCheckCircle /> Verified
                      </span>
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/70 px-3 py-2 text-xs font-medium text-emerald-900">
                        Presentation received
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-emerald-950">Presentation summary</h3>
                    <p className="mt-1 text-xs opacity-80">Showing revealed fields if available.</p>
                  </div>

                  <button
                    className="btn btn-outline btn-sm gap-2"
                    onClick={async () => {
                      const text = `name: ${revealedName || "-"}\nnumeric: ${revealedNumeric || "-"}`;
                      const ok = await copyText(text);
                      pushToast(ok ? "Copied" : "Copy failed");
                    }}
                  >
                    <FiCopy /> Copy
                  </button>
                </div>

                <div className="mt-4 grid gap-2">
                  <div className="flex items-center justify-between rounded-2xl border border-base-300/60 bg-white/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0B3A6A]">
                      <FiUser /> Name
                    </div>
                    <div className="text-sm font-semibold">
                      {revealedName ? revealedName : <span className="opacity-60">—</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-base-300/60 bg-white/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0B3A6A]">
                      <FiHash /> Numeric
                    </div>
                    <div className="text-sm font-semibold">
                      {revealedNumeric ? revealedNumeric : <span className="opacity-60">—</span>}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs opacity-70">
                  {presentation?.proofRequestId && (
                    <span className="badge badge-outline px-4 py-3 leading-none">
                      proofRequest: {maskId(presentation.proofRequestId)}
                    </span>
                  )}
                  {presentation?.credentialId && (
                    <span className="badge badge-outline px-4 py-3 leading-none">
                      credential: {maskId(presentation.credentialId)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 grid gap-3">
          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <FiAlertTriangle />
                </div>
                <span className="wrap-break-words">{err}</span>
              </div>
            </div>
          )}

          {toast && (
            <div className="toast toast-end">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm">
                <span>{toast}</span>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 text-center text-xs opacity-60">
          © Bangladesh Road Transport Authority (BRTA) — Simulation interface for research and demonstration
        </div>
      </div>
    </div>
  );
}
