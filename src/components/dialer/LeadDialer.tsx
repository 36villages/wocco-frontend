"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { toE164 } from "@/lib/dialer/types";
import Dialer, { type DialerCallSummary } from "./Dialer";

type LeadStatus = "called" | "interested" | "not_interested" | "no_answer" | "callback" | "closed_won";

const OUTCOMES: { status: LeadStatus; label: string; color: string }[] = [
  { status: "interested", label: "Interested", color: "#34d399" },
  { status: "callback", label: "Call back", color: "#c084fc" },
  { status: "no_answer", label: "No answer", color: "#9ca3af" },
  { status: "not_interested", label: "Not interested", color: "#f87171" },
  { status: "closed_won", label: "Closed won", color: "#10b981" },
  { status: "called", label: "Just log call", color: "#fbbf24" },
];

const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;

/** Every distinct phone on a lead: the phone field first, then anything found in the notes. */
export function leadPhones(lead: any): string[] {
  const raw = [lead?.phone, ...(String(lead?.notes ?? "").match(PHONE_RE) ?? [])].filter(Boolean) as string[];
  const seen = new Set<string>();
  return raw.filter((p) => {
    const key = toE164(p) ?? p.replace(/\D/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function leadName(lead: any): string {
  const person = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ").trim();
  return (lead?.leadType === "individual" ? person || lead?.title : lead?.title || person) || "Lead";
}

/** Default callback time: tomorrow 10:00 local, formatted for <input type="datetime-local">. */
function tomorrowAtTen() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type OnSaved = (status: string, callbackDate?: string) => void;

const LeadDialerContext = createContext<{ open: (lead: any, onSaved?: OnSaved) => void } | null>(null);

/**
 * One dialer drawer for the whole dashboard. It stays mounted after first use so the browser
 * softphone remains registered between calls.
 */
export function LeadDialerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ lead: any; onSaved?: OnSaved } | null>(null);
  const [visible, setVisible] = useState(false);
  const [phoneIndex, setPhoneIndex] = useState(0);
  const [lastCall, setLastCall] = useState<DialerCallSummary | null>(null);
  const [saving, setSaving] = useState<LeadStatus | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pickingCallback, setPickingCallback] = useState(false);
  const [callbackAt, setCallbackAt] = useState(tomorrowAtTen);

  const open = useCallback((lead: any, onSaved?: OnSaved) => {
    setTarget({ lead, onSaved });
    setPhoneIndex(0);
    setLastCall(null);
    setSaveError(null);
    setPickingCallback(false);
    setCallbackAt(tomorrowAtTen());
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, close]);

  const lead = target?.lead;
  const phones = useMemo(() => leadPhones(lead), [lead]);

  async function saveOutcome(status: LeadStatus) {
    if (!lead) return;
    if (status === "callback" && !pickingCallback) {
      setPickingCallback(true);
      return;
    }
    setSaving(status);
    setSaveError(null);
    try {
      await api.patch("/leads/" + lead.id + "/status", { status });
      let callbackDate: string | undefined;
      if (status === "callback") {
        callbackDate = new Date(callbackAt).toISOString();
        await api.patch("/leads/" + lead.id + "/callback", { callbackDate });
      }
      target?.onSaved?.(status, callbackDate);
      setVisible(false);
    } catch (e) {
      setSaveError(getErrorMessage(e, "Could not save the outcome"));
    } finally {
      setSaving(null);
    }
  }

  const suggested: LeadStatus | null = lastCall ? (lastCall.outcome === "failed" ? "no_answer" : "called") : null;
  const value = useMemo(() => ({ open }), [open]);

  return (
    <LeadDialerContext.Provider value={value}>
      {children}
      {lead && (
        <>
          <div
            onClick={close}
            style={{ position: "fixed", inset: 0, background: "rgba(3,7,18,0.6)", zIndex: 60, transition: "opacity 150ms", opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
          />
          <aside
            role="dialog"
            aria-label={`Call ${leadName(lead)}`}
            aria-hidden={!visible}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0, width: "100%", maxWidth: 380, background: "#111827",
              borderLeft: "1px solid #1f2937", zIndex: 61, padding: 20, overflowY: "auto", boxSizing: "border-box",
              transition: "transform 180ms ease-out", transform: visible ? "translateX(0)" : "translateX(100%)",
              visibility: visible ? "visible" : "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ ...s.eyebrow, margin: "0 0 4px" }}>{lead.leadType === "individual" ? "Individual" : "Business"}</p>
                <p style={{ color: "white", fontSize: 16, fontWeight: 800, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {leadName(lead)}
                </p>
              </div>
              <button type="button" onClick={close} aria-label="Close" style={{ ...s.btn, padding: "6px 10px" }}>✕</button>
            </div>

            {phones.length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {phones.map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPhoneIndex(i)}
                    style={{ ...s.btn, borderColor: i === phoneIndex ? "#34d399" : "#374151", color: i === phoneIndex ? "#34d399" : "#9ca3af" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Keep the Dialer mounted while hidden so the softphone stays registered. */}
            <Dialer phoneNumber={phones[phoneIndex] ?? ""} leadName={leadName(lead)} onCallEnded={setLastCall} style={{ maxWidth: "none" }} />

            <div style={{ marginTop: 16 }}>
              <p style={{ ...s.eyebrow, margin: "0 0 8px" }}>{lastCall ? "How did it go?" : "Set outcome"}</p>
              {pickingCallback ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ ...s.eyebrow, display: "flex", flexDirection: "column", gap: 4 }}>
                    Call back at
                    <input
                      type="datetime-local"
                      value={callbackAt}
                      onChange={(e) => setCallbackAt(e.target.value)}
                      style={{ background: "#030712", border: "1px solid #374151", borderRadius: 8, color: "white", padding: "8px 10px", fontSize: 13, colorScheme: "dark" }}
                    />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => setPickingCallback(false)} style={s.btn}>Back</button>
                    <button
                      type="button"
                      disabled={!callbackAt || saving !== null}
                      onClick={() => void saveOutcome("callback")}
                      style={{ ...s.btn, flex: 1, background: "#2563eb", borderColor: "#2563eb", color: "white", fontWeight: 600 }}
                    >
                      {saving ? "Saving…" : "Schedule callback"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {OUTCOMES.map((o) => (
                    <button
                      key={o.status}
                      type="button"
                      disabled={saving !== null}
                      onClick={() => void saveOutcome(o.status)}
                      style={{
                        ...s.btn,
                        color: o.color,
                        padding: "9px 6px",
                        background: suggested === o.status ? "rgba(255,255,255,0.05)" : "transparent",
                        borderColor: suggested === o.status ? o.color : "#374151",
                      }}
                    >
                      {saving === o.status ? "Saving…" : o.label}
                    </button>
                  ))}
                </div>
              )}
              {saveError && <p style={{ color: "#f87171", fontSize: 12, margin: "10px 0 0" }}>{saveError}</p>}
            </div>
          </aside>
        </>
      )}
    </LeadDialerContext.Provider>
  );
}

export function useLeadDialer() {
  const ctx = useContext(LeadDialerContext);
  if (!ctx) throw new Error("useLeadDialer must be used inside <LeadDialerProvider>");
  return ctx;
}

/** Call button for a lead row or detail page. Stops propagation so a row's own click doesn't fire. */
export function LeadCallButton({ lead, onSaved, size = "sm" }: { lead: any; onSaved?: OnSaved; size?: "sm" | "md" }) {
  const { open } = useLeadDialer();
  const hasPhone = useMemo(() => leadPhones(lead).length > 0, [lead]);

  return (
    <button
      type="button"
      disabled={!hasPhone}
      title={hasPhone ? `Call ${leadName(lead)}` : "No phone number on this lead"}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        open(lead, onSaved);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        background: hasPhone ? "#16a34a" : "#1f2937",
        border: "none",
        color: hasPhone ? "white" : "#4b5563",
        borderRadius: 8,
        padding: size === "sm" ? "6px 12px" : "10px 16px",
        fontSize: size === "sm" ? 12 : 13,
        fontWeight: 600,
        cursor: hasPhone ? "pointer" : "not-allowed",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" />
      </svg>
      Call
    </button>
  );
}

const s = {
  eyebrow: { color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" },
  btn: { background: "transparent", border: "1px solid #374151", color: "#d1d5db", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" },
} satisfies Record<string, React.CSSProperties>;
