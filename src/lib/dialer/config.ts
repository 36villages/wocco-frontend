import "server-only";
import type { DialMode, ProviderId, ProviderInfo } from "./types";
import { PROVIDER_LABELS } from "./types";

const env = (key: string) => process.env[key]?.trim() || undefined;
const list = (key: string) => (env(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const signalwire = {
  space: env("SIGNALWIRE_SPACE_URL"), // e.g. greymoon.signalwire.com
  projectId: env("SIGNALWIRE_PROJECT_ID"),
  apiToken: env("SIGNALWIRE_API_TOKEN"),
  callerIds: list("SIGNALWIRE_CALLER_IDS"),
  sipWss: env("SIGNALWIRE_SIP_WSS_URL"),
  sipUri: env("SIGNALWIRE_SIP_URI"),
  sipPassword: env("SIGNALWIRE_SIP_PASSWORD"),
};

export const telnyx = {
  apiKey: env("TELNYX_API_KEY"),
  texmlAppId: env("TELNYX_TEXML_APP_ID"),
  credentialId: env("TELNYX_TELEPHONY_CREDENTIAL_ID"),
  callerIds: list("TELNYX_CALLER_IDS"),
};

export const plivo = {
  authId: env("PLIVO_AUTH_ID"),
  authToken: env("PLIVO_AUTH_TOKEN"),
  endpointUsername: env("PLIVO_ENDPOINT_USERNAME"),
  endpointPassword: env("PLIVO_ENDPOINT_PASSWORD"),
  callerIds: list("PLIVO_CALLER_IDS"),
};

export const voipms = {
  wssUrl: env("VOIPMS_WSS_URL"), // your WebRTC→SIP gateway; VoIP.ms itself has no WebSocket endpoint
  sipUri: env("VOIPMS_SIP_URI"), // e.g. sip:123456_agent@chicago.voip.ms
  sipPassword: env("VOIPMS_SIP_PASSWORD"),
  callerIds: list("VOIPMS_CALLER_IDS"),
};

export const appBaseUrl = () => env("DIALER_PUBLIC_BASE_URL") ?? (env("VERCEL_URL") ? `https://${env("VERCEL_URL")}` : undefined);
export const signingSecret = () => env("DIALER_SIGNING_SECRET");

const ALL_PROVIDERS = Object.keys(PROVIDER_LABELS) as ProviderId[];

/**
 * Carriers the dialer offers, in priority order; the first is the primary/default.
 * Plivo is primary. Secondary carriers stay off until a dev adds them, e.g.
 * DIALER_PROVIDERS=plivo,telnyx. Read per request, so no code change is needed.
 */
export function activeProviderIds(): ProviderId[] {
  const configured = list("DIALER_PROVIDERS").map((s) => s.toLowerCase()) as ProviderId[];
  const ids = Array.from(new Set(configured)).filter((id) => ALL_PROVIDERS.includes(id));
  return ids.length > 0 ? ids : ["plivo"];
}

function modesFor(id: ProviderId): DialMode[] {
  const modes: DialMode[] = [];
  if (!activeProviderIds().includes(id)) return modes;
  const canBridge = !!appBaseUrl() && !!signingSecret();
  switch (id) {
    case "signalwire":
      if (canBridge && signalwire.space && signalwire.projectId && signalwire.apiToken) modes.push("bridge");
      if (signalwire.sipWss && signalwire.sipUri && signalwire.sipPassword) modes.push("browser");
      break;
    case "telnyx":
      if (canBridge && telnyx.apiKey && telnyx.texmlAppId) modes.push("bridge");
      if (telnyx.apiKey && telnyx.credentialId) modes.push("browser");
      break;
    case "plivo":
      if (canBridge && plivo.authId && plivo.authToken) modes.push("bridge");
      if (plivo.endpointUsername && plivo.endpointPassword) modes.push("browser");
      break;
    case "voipms":
      if (voipms.wssUrl && voipms.sipUri && voipms.sipPassword) modes.push("browser");
      break;
  }
  return modes;
}

const CALLER_IDS: Record<ProviderId, string[]> = {
  signalwire: signalwire.callerIds,
  telnyx: telnyx.callerIds,
  plivo: plivo.callerIds,
  voipms: voipms.callerIds,
};

export function enabledProviders(): ProviderInfo[] {
  return activeProviderIds()
    .map((id, i) => ({ id, label: PROVIDER_LABELS[id], primary: i === 0, modes: modesFor(id), callerIds: CALLER_IDS[id] }))
    .filter((p) => p.modes.length > 0);
}

export function providerSupports(id: ProviderId, mode: DialMode) {
  return modesFor(id).includes(mode);
}

export function isAllowedCallerId(id: ProviderId, from: string) {
  return CALLER_IDS[id].includes(from);
}
