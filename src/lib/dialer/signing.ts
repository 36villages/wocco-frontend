import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// The carrier fetches the bridge XML from a public URL; the HMAC stops anyone else from
// using that URL to make our numbers dial arbitrary destinations.

const payload = (to: string, from: string, exp: number) => `${to}|${from}|${exp}`;

export function sign(secret: string, to: string, from: string, exp: number) {
  return createHmac("sha256", secret).update(payload(to, from, exp)).digest("hex");
}

export function verify(secret: string, to: string, from: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || Date.now() / 1000 > exp) return false;
  const expected = Buffer.from(sign(secret, to, from, exp), "hex");
  const given = Buffer.from(sig, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
