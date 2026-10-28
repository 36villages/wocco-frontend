import { NextResponse } from "next/server";
import { requireDialerUser } from "@/lib/dialer/auth";
import { placeBridgeCall } from "@/lib/dialer/bridge";
import { isAllowedCallerId, providerSupports } from "@/lib/dialer/config";
import { toE164, type BridgeCallRequest, type BridgeCallResponse } from "@/lib/dialer/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await requireDialerUser(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<BridgeCallRequest> | null;
  const to = toE164(body?.to ?? "");
  const agentPhone = toE164(body?.agentPhone ?? "");
  const from = body?.from ?? "";
  const provider = body?.provider;

  if (!provider || !providerSupports(provider, "bridge")) {
    return NextResponse.json({ error: "Provider is not configured for click-to-call" }, { status: 400 });
  }
  if (!to || !agentPhone) return NextResponse.json({ error: "Enter valid phone numbers" }, { status: 400 });
  if (!isAllowedCallerId(provider, from)) return NextResponse.json({ error: "Caller ID is not allowed" }, { status: 400 });

  try {
    const callId = await placeBridgeCall(provider, agentPhone, to, from);
    return NextResponse.json({ callId } satisfies BridgeCallResponse);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
