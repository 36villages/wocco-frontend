export type ProviderId = "signalwire" | "telnyx" | "plivo" | "voipms";

/**
 * bridge  – server asks the carrier to ring the agent's phone, then connects it to the lead (click-to-call).
 * browser – the call runs in the browser over WebRTC; agent uses a headset.
 */
export type DialMode = "bridge" | "browser";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** First carrier in DIALER_PROVIDERS; selected by default. */
  primary: boolean;
  modes: DialMode[];
  callerIds: string[];
}

export interface DialerConfigResponse {
  providers: ProviderInfo[];
  defaultAgentPhone: string | null;
}

export type BrowserCredentials =
  | { provider: "telnyx"; loginToken: string }
  | { provider: "plivo"; username: string; password: string }
  | { provider: "voipms" | "signalwire"; wssUrl: string; sipUri: string; password: string; displayName?: string };

export interface BridgeCallRequest {
  provider: ProviderId;
  to: string;
  from: string;
  agentPhone: string;
}

export interface BridgeCallResponse {
  callId: string;
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  signalwire: "SignalWire",
  telnyx: "Telnyx",
  plivo: "Plivo",
  voipms: "VoIP.ms",
};

/** Lenient E.164 normaliser: strips formatting, assumes NANP for bare 10-digit numbers. */
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
