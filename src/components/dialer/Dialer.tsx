"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  toE164,
  type BridgeCallResponse,
  type BrowserCredentials,
  type DialMode,
  type DialerConfigResponse,
  type ProviderId,
  type ProviderInfo,
} from "@/lib/dialer/types";
import { createSoftphone, type CallState, type Softphone } from "./adapters";

export interface DialerCallSummary {
  provider: ProviderId;
  mode: DialMode;
  to: string;
  from: string;
  startedAt: Date;
  durationSeconds: number;
  outcome: "completed" | "failed";
}

interface DialerProps {
  /** Pre-fill the number, e.g. from a lead row. */
  phoneNumber?: string;
  /** Shown above the number when dialing a known lead. */
  leadName?: string;
  /** Fires when a browser call ends, or once a bridge call has been handed to the carrier. Use it to log activity on the lead. */
  onCallEnded?: (summary: DialerCallSummary) => void;
  style?: CSSProperties;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const PREFS_KEY = "greymoon.dialer";

const STATUS_TEXT: Record<CallState, string> = {
  idle: "Ready",
  registering: "Connecting to carrier…",
  dialing: "Dialing…",
  ringing: "Ringing…",
  active: "Connected",
  ended: "Call ended",
  failed: "Call failed",
};

const LIVE_STATES: CallState[] = ["dialing", "ringing", "active"];

function readPrefs(): { provider?: ProviderId; mode?: DialMode; from?: string; agentPhone?: string } {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writePrefs(prefs: object) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

/** Dialer routes live in this app; they check the wocco backend token the rest of the dashboard uses. */
function dialerFetch(path: string, body?: object) {
  const token = localStorage.getItem("access_token");
  return fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Dialer({ phoneNumber, leadName, onCallEnded, style }: DialerProps) {
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);
  const [providerId, setProviderId] = useState<ProviderId | null>(null);
  const [mode, setMode] = useState<DialMode>("browser");
  const [from, setFrom] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [number, setNumber] = useState(phoneNumber ?? "");
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const phoneRef = useRef<{ key: ProviderId; phone: Softphone } | null>(null);
  const callRef = useRef<{ to: string; from: string; startedAt: Date; answeredAt?: number } | null>(null);
  const onCallEndedRef = useRef(onCallEnded);
  onCallEndedRef.current = onCallEnded;

  const providerIdRef = useRef(providerId);
  providerIdRef.current = providerId;

  const provider = providers?.find((p) => p.id === providerId) ?? null;
  const live = LIVE_STATES.includes(state);
  const busy = live || state === "registering";

  useEffect(() => {
    if (phoneNumber !== undefined) setNumber(phoneNumber);
  }, [phoneNumber]);

  useEffect(() => {
    dialerFetch("/api/dialer/config")
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "Sign in to use the dialer" : "Could not load dialer settings");
        return (await res.json()) as DialerConfigResponse;
      })
      .then((cfg) => {
        setProviders(cfg.providers);
        const prefs = readPrefs();
        const initial = cfg.providers.find((p) => p.id === prefs.provider) ?? cfg.providers[0];
        if (!initial) return;
        setProviderId(initial.id);
        setMode(prefs.mode && initial.modes.includes(prefs.mode) ? prefs.mode : initial.modes[0]);
        setFrom(prefs.from && initial.callerIds.includes(prefs.from) ? prefs.from : initial.callerIds[0] ?? "");
        setAgentPhone(prefs.agentPhone || cfg.defaultAgentPhone || "");
      })
      .catch((e: Error) => {
        setProviders([]);
        setError(e.message);
      });
  }, []);

  useEffect(() => {
    if (providerId) writePrefs({ provider: providerId, mode, from, agentPhone });
  }, [providerId, mode, from, agentPhone]);

  useEffect(() => {
    if (state !== "active") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  // Tear down the registered softphone when leaving the page or switching carrier.
  useEffect(() => () => phoneRef.current?.phone.destroy(), []);

  const handleState = useCallback((next: CallState, detail?: string) => {
    setState(next);
    if (next === "active" && callRef.current && !callRef.current.answeredAt) callRef.current.answeredAt = Date.now();
    if (next === "failed" && detail) setError(detail);
    if ((next === "ended" || next === "failed") && callRef.current && providerIdRef.current) {
      const c = callRef.current;
      callRef.current = null;
      setMuted(false);
      onCallEndedRef.current?.({
        provider: providerIdRef.current,
        mode: "browser",
        to: c.to,
        from: c.from,
        startedAt: c.startedAt,
        durationSeconds: c.answeredAt ? Math.round((Date.now() - c.answeredAt) / 1000) : 0,
        outcome: next === "failed" || !c.answeredAt ? "failed" : "completed",
      });
    }
  }, []);

  async function getSoftphone(id: ProviderId): Promise<Softphone> {
    if (phoneRef.current?.key === id) return phoneRef.current.phone;
    phoneRef.current?.phone.destroy();
    phoneRef.current = null;

    setState("registering");
    const res = await dialerFetch("/api/dialer/token", { provider: id });
    const creds = await res.json();
    if (!res.ok) throw new Error(creds.error ?? "Could not get calling credentials");
    const phone = await createSoftphone(creds as BrowserCredentials, audioRef.current!, handleState);
    phoneRef.current = { key: id, phone };
    return phone;
  }

  async function startCall() {
    if (!provider) return;
    setError(null);
    setNotice(null);
    const to = toE164(number);
    if (!to) return setError("Enter a valid phone number");

    if (mode === "bridge") {
      const agent = toE164(agentPhone);
      if (!agent) return setError("Enter the phone number to ring you on");
      setState("dialing");
      try {
        const res = await dialerFetch("/api/dialer/call", { provider: provider.id, to, from, agentPhone: agent });
        const body = (await res.json()) as BridgeCallResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Call failed");
        setNotice(`Calling you at ${agent} — answer to be connected to ${to}.`);
        setState("idle");
        onCallEnded?.({ provider: provider.id, mode, to, from, startedAt: new Date(), durationSeconds: 0, outcome: "completed" });
      } catch (e) {
        setState("failed");
        setError((e as Error).message);
      }
      return;
    }

    try {
      const phone = await getSoftphone(provider.id);
      setSeconds(0);
      callRef.current = { to, from, startedAt: new Date() };
      await phone.call(to, from);
    } catch (e) {
      callRef.current = null;
      setState("failed");
      setError((e as Error).message);
    }
  }

  function hangup() {
    phoneRef.current?.phone.hangup();
  }

  function toggleMute() {
    phoneRef.current?.phone.setMuted(!muted);
    setMuted(!muted);
  }

  function pressKey(key: string) {
    if (state === "active" && mode === "browser") phoneRef.current?.phone.sendDigit(key);
    else if (!busy) setNumber((n) => n + key);
  }

  function selectProvider(id: ProviderId) {
    const p = providers!.find((x) => x.id === id)!;
    setProviderId(id);
    if (!p.modes.includes(mode)) setMode(p.modes[0]);
    if (!p.callerIds.includes(from)) setFrom(p.callerIds[0] ?? "");
  }

  if (providers === null) {
    return <div style={{ ...s.card, ...style, color: "var(--dialer-muted, #6b7280)", fontSize: 13 }}>Loading dialer…</div>;
  }

  if (providers.length === 0) {
    return (
      <div style={{ ...s.card, ...style }}>
        <p style={s.title}>Dialer</p>
        <p style={{ color: "var(--dialer-subtle, #9ca3af)", fontSize: 13, margin: 0 }}>
          {error ?? "Plivo isn't configured yet. Add the Plivo environment variables in Vercel."}
        </p>
      </div>
    );
  }

  const statusColor = state === "active" ? "#34d399" : state === "failed" ? "#f87171" : live ? "#fbbf24" : "var(--dialer-subtle, #9ca3af)";

  return (
    <div style={{ ...s.card, ...style }}>
      <audio ref={audioRef} autoPlay />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={s.title}>Dialer</p>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: statusColor }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: statusColor }} />
          {STATUS_TEXT[state]}
          {state === "active" && <span style={{ fontVariantNumeric: "tabular-nums" }}>· {formatTimer(seconds)}</span>}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8, marginBottom: 12 }}>
        <label style={s.label}>
          Carrier
          {providers.length > 1 ? (
            <select style={s.input} value={providerId ?? ""} disabled={busy} onChange={(e) => selectProvider(e.target.value as ProviderId)}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.primary ? `${p.label} (primary)` : p.label}
                </option>
              ))}
            </select>
          ) : (
            <input style={s.input} value={provider?.label ?? ""} disabled />
          )}
        </label>
        <label style={s.label}>
          Caller ID
          {provider && provider.callerIds.length > 0 ? (
            <select style={s.input} value={from} disabled={busy} onChange={(e) => setFrom(e.target.value)}>
              {provider.callerIds.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <input style={{ ...s.input, color: "var(--dialer-muted, #6b7280)" }} value="Set by SIP account" disabled />
          )}
        </label>
      </div>

      {provider && provider.modes.length > 1 && (
        <div style={{ display: "flex", background: "var(--dialer-input, #030712)", borderRadius: 8, padding: 3, marginBottom: 12 }}>
          {provider.modes.map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => setMode(m)}
              style={{
                ...s.segment,
                background: mode === m ? "var(--dialer-raised, #1f2937)" : "transparent",
                color: mode === m ? "var(--dialer-text, #fff)" : "var(--dialer-subtle, #9ca3af)",
              }}
            >
              {m === "browser" ? "Browser (headset)" : "Ring my phone"}
            </button>
          ))}
        </div>
      )}

      {mode === "bridge" && (
        <label style={{ ...s.label, marginBottom: 12 }}>
          Ring me at
          <input style={s.input} type="tel" placeholder="+1 555 123 4567" value={agentPhone} disabled={busy} onChange={(e) => setAgentPhone(e.target.value)} />
        </label>
      )}

      {leadName && <p style={{ color: "var(--dialer-subtle, #9ca3af)", fontSize: 12, margin: "0 0 4px", textAlign: "center" }}>{leadName}</p>}
      <input
        type="tel"
        aria-label="Phone number to call"
        placeholder="Enter number"
        value={number}
        disabled={busy}
        onChange={(e) => setNumber(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !busy && void startCall()}
        style={s.number}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, margin: "12px 0" }}>
        {KEYS.map((k) => (
          <button key={k} type="button" onClick={() => pressKey(k)} style={s.key}>
            {k}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {live && mode === "browser" ? (
          <>
            <button type="button" onClick={toggleMute} style={{ ...s.action, background: muted ? "#fbbf24" : "var(--dialer-raised, #1f2937)", color: muted ? "var(--dialer-input, #030712)" : "var(--dialer-text, #fff)" }}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button type="button" onClick={hangup} style={{ ...s.action, flex: 2, background: "#dc2626" }}>
              Hang up
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy || !number} onClick={() => setNumber((n) => n.slice(0, -1))} style={{ ...s.action, background: "var(--dialer-raised, #1f2937)" }}>
              ⌫
            </button>
            <button type="button" disabled={busy || !number} onClick={() => void startCall()} style={{ ...s.action, flex: 2, background: "var(--dialer-call, #16a34a)", opacity: busy || !number ? 0.5 : 1 }}>
              {busy ? STATUS_TEXT[state] : "Call"}
            </button>
          </>
        )}
      </div>

      {notice && <p style={{ ...s.message, color: "var(--dialer-accent, #93c5fd)" }}>{notice}</p>}
      {error && <p style={{ ...s.message, color: "#f87171" }}>{error}</p>}
    </div>
  );
}

const s = {
  card: { background: "var(--dialer-card, #111827)", border: "1px solid var(--dialer-border, #1f2937)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 340, boxSizing: "border-box" },
  title: { color: "var(--dialer-text, #fff)", fontWeight: 700, fontSize: 15, margin: 0 },
  label: { display: "flex", flexDirection: "column", gap: 4, color: "var(--dialer-muted, #6b7280)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { background: "var(--dialer-input, #030712)", border: "1px solid var(--dialer-border, #1f2937)", borderRadius: 8, color: "var(--dialer-text, #fff)", fontSize: 13, padding: "8px 10px", textTransform: "none", letterSpacing: 0, minWidth: 0, width: "100%", boxSizing: "border-box", textOverflow: "ellipsis" },
  segment: { flex: 1, border: 0, borderRadius: 6, padding: "7px 8px", fontSize: 12, cursor: "pointer" },
  number: { width: "100%", boxSizing: "border-box", background: "transparent", border: 0, borderBottom: "1px solid var(--dialer-border, #1f2937)", color: "var(--dialer-text, #fff)", fontSize: 24, textAlign: "center", padding: "8px 0", outline: "none", fontVariantNumeric: "tabular-nums" },
  key: { background: "var(--dialer-raised, #1f2937)", border: 0, borderRadius: 10, color: "var(--dialer-text, #fff)", fontSize: 18, padding: "12px 0", cursor: "pointer" },
  action: { flex: 1, border: 0, borderRadius: 10, color: "var(--dialer-text, #fff)", fontSize: 14, fontWeight: 600, padding: "12px 0", cursor: "pointer" },
  message: { fontSize: 12, margin: "12px 0 0", lineHeight: 1.4 },
} satisfies Record<string, CSSProperties>;
