import "server-only";
import { plivo, signalwire, telnyx, voipms } from "./config";
import type { BrowserCredentials, ProviderId } from "./types";

export async function browserCredentials(provider: ProviderId): Promise<BrowserCredentials> {
  switch (provider) {
    case "telnyx": {
      // Short-lived JWT for the WebRTC SDK; the API key never reaches the browser.
      const res = await fetch(`https://api.telnyx.com/v2/telephony_credentials/${telnyx.credentialId}/token`, {
        method: "POST",
        headers: { Authorization: `Bearer ${telnyx.apiKey}` },
      });
      if (!res.ok) throw new Error(`Telnyx token request failed (${res.status})`);
      return { provider, loginToken: (await res.text()).trim() };
    }
    case "plivo":
      return { provider, username: plivo.endpointUsername!, password: plivo.endpointPassword! };
    case "signalwire":
      return { provider, wssUrl: signalwire.sipWss!, sipUri: signalwire.sipUri!, password: signalwire.sipPassword! };
    case "voipms":
      return { provider, wssUrl: voipms.wssUrl!, sipUri: voipms.sipUri!, password: voipms.sipPassword! };
  }
}
