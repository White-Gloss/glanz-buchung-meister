import { createHmac, timingSafeEqual } from "node:crypto";
import { site } from "../data/site.ts";
function secret() {
  const value = process.env.BETTER_AUTH_SECRET || "";
  if (value.length < 32) throw new Error("status_secret_missing");
  return value;
}
export function bookingStatusToken(id: number) {
  return createHmac("sha256", secret()).update(`ro-booking-status:v1:${id}`).digest("base64url");
}
export function verifyBookingStatusToken(id: number, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(bookingStatusToken(id)));
}
export function bookingStatusUrl(id: number) {
  return `${site.origin}/auftragsstatus?vorgang=WG-${id}&token=${bookingStatusToken(id)}`;
}
