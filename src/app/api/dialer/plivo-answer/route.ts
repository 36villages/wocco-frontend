import { bridgeXml } from "@/lib/dialer/bridge";
import { isAllowedCallerId } from "@/lib/dialer/config";

// Answer URL for the Plivo application attached to the browser endpoint. Plivo hits it when the
// softphone places a call; the X-PH-From header set by the browser arrives as a parameter.
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const params = req.method === "POST" ? await req.formData() : new URL(req.url).searchParams;
  const to = String(params.get("To") ?? "");
  const from = `+${String(params.get("X-PH-From") ?? "").replace(/^\+/, "")}`;

  if (!/^\d{8,15}$/.test(to) || !isAllowedCallerId("plivo", from)) {
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`, {
      headers: { "Content-Type": "application/xml" },
    });
  }
  return new Response(bridgeXml("plivo", to, from), { headers: { "Content-Type": "application/xml" } });
}

export const GET = handle;
export const POST = handle;
