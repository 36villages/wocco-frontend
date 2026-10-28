import { bridgeXml } from "@/lib/dialer/bridge";
import { signingSecret } from "@/lib/dialer/config";
import { verify } from "@/lib/dialer/signing";
import type { ProviderId } from "@/lib/dialer/types";

// Fetched by the carrier (not the browser) once the agent answers. Authenticated by the HMAC
// in the query string, so it deliberately skips requireDialerUser.
export const dynamic = "force-dynamic";

const PROVIDERS: ProviderId[] = ["signalwire", "telnyx", "plivo"];

function handle(req: Request) {
  const q = new URL(req.url).searchParams;
  const provider = q.get("p") as ProviderId;
  const to = q.get("to") ?? "";
  const from = q.get("from") ?? "";
  const secret = signingSecret();

  if (!secret || !PROVIDERS.includes(provider) || !verify(secret, to, from, Number(q.get("exp")), q.get("sig") ?? "")) {
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`, {
      status: 403,
      headers: { "Content-Type": "application/xml" },
    });
  }
  return new Response(bridgeXml(provider, to, from), { headers: { "Content-Type": "application/xml" } });
}

export const GET = handle;
export const POST = handle;
