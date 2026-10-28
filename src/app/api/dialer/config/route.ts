import { NextResponse } from "next/server";
import { requireDialerUser } from "@/lib/dialer/auth";
import { enabledProviders } from "@/lib/dialer/config";
import type { DialerConfigResponse } from "@/lib/dialer/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await requireDialerUser(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Agents' own "ring me at" numbers are remembered in the browser by the Dialer.
  const body: DialerConfigResponse = {
    providers: enabledProviders(),
    defaultAgentPhone: process.env.DIALER_DEFAULT_AGENT_PHONE || null,
  };
  return NextResponse.json(body);
}
