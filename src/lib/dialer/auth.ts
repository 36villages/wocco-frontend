import "server-only";

// The dialer routes run in this Next.js app, but sessions belong to the wocco backend. We forward
// the browser's bearer token to an authenticated backend endpoint; a 2xx means a signed-in user.
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
const CHECK_PATH = process.env.DIALER_AUTH_CHECK_PATH || "/leads?limit=1";
const CACHE_MS = 60_000;

const verified = new Map<string, number>();

/** Every dialer route that spends money or hands out SIP credentials goes through here. */
export async function requireDialerUser(req: Request): Promise<{ token: string } | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const until = verified.get(token);
  if (until && until > Date.now()) return { token };

  try {
    const res = await fetch(`${API_URL}${CHECK_PATH}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      verified.delete(token);
      return null;
    }
  } catch {
    return null;
  }
  verified.set(token, Date.now() + CACHE_MS);
  return { token };
}
