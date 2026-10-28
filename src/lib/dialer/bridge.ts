import "server-only";
import { appBaseUrl, plivo, signalwire, signingSecret, telnyx } from "./config";
import { sign } from "./signing";
import type { ProviderId } from "./types";

// Bridge links stay valid long enough for the agent to pick up their phone.
const LINK_TTL_SECONDS = 120;

function bridgeUrl(provider: ProviderId, to: string, from: string) {
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const params = new URLSearchParams({ p: provider, to, from, exp: String(exp), sig: sign(signingSecret()!, to, from, exp) });
  return `${appBaseUrl()}/api/dialer/bridge?${params}`;
}

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

async function expectOk(res: Response, carrier: string) {
  if (res.ok) return res.json();
  const body = await res.text();
  throw new Error(`${carrier} rejected the call (${res.status}): ${body.slice(0, 300)}`);
}

/**
 * Rings `agentPhone` from `from`; when the agent answers, the carrier fetches the bridge XML
 * and dials `to` with `from` as caller ID. Returns the carrier's call ID.
 */
export async function placeBridgeCall(provider: ProviderId, agentPhone: string, to: string, from: string): Promise<string> {
  const url = bridgeUrl(provider, to, from);

  switch (provider) {
    case "signalwire": {
      const res = await fetch(
        `https://${signalwire.space}/api/laml/2010-04-01/Accounts/${signalwire.projectId}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: basic(signalwire.projectId!, signalwire.apiToken!),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: agentPhone, From: from, Url: url, Method: "POST" }),
        },
      );
      return (await expectOk(res, "SignalWire")).sid;
    }
    case "telnyx": {
      const res = await fetch(`https://api.telnyx.com/v2/texml/calls/${telnyx.texmlAppId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${telnyx.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ To: agentPhone, From: from, Url: url, UrlMethod: "POST" }),
      });
      const json = await expectOk(res, "Telnyx");
      return json.data?.call_sid ?? json.data?.call_control_id ?? "";
    }
    case "plivo": {
      const res = await fetch(`https://api.plivo.com/v1/Account/${plivo.authId}/Call/`, {
        method: "POST",
        headers: { Authorization: basic(plivo.authId!, plivo.authToken!), "Content-Type": "application/json" },
        body: JSON.stringify({ from: from.replace(/^\+/, ""), to: agentPhone.replace(/^\+/, ""), answer_url: url, answer_method: "POST" }),
      });
      return (await expectOk(res, "Plivo")).request_uuid;
    }
    case "voipms":
      throw new Error("VoIP.ms has no API to originate calls; use browser mode.");
  }
}

const escapeXml = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/** LaML (SignalWire), TeXML (Telnyx) and Plivo XML all accept this same <Dial><Number> shape. */
export function bridgeXml(provider: ProviderId, to: string, from: string) {
  const callerId = provider === "plivo" ? from.replace(/^\+/, "") : from;
  const number = provider === "plivo" ? to.replace(/^\+/, "") : to;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}"><Number>${escapeXml(number)}</Number></Dial>
</Response>`;
}
