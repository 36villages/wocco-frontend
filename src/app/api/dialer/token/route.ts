import { NextResponse } from "next/server";
import { requireDialerUser } from "@/lib/dialer/auth";
import { browserCredentials } from "@/lib/dialer/browser-credentials";
import { providerSupports } from "@/lib/dialer/config";
import type { ProviderId } from "@/lib/dialer/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await requireDialerUser(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = ((await req.json().catch(() => ({}))) ?? {}) as { provider?: ProviderId };
  if (!provider || !providerSupports(provider, "browser")) {
    return NextResponse.json({ error: "Provider is not configured for browser calling" }, { status: 400 });
  }
  try {
    return NextResponse.json(await browserCredentials(provider), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
