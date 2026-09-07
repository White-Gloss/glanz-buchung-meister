import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const UPLOAD_CAPABILITY_TTL_SECONDS = 7 * 24 * 60 * 60;

export type UploadCapability = { token: string; hash: string; expiresAt: string };

/** A form retry must recover the same capability without persisting its token. */
export function createRequestUploadCapability(
  requestKey: string,
  now = new Date(),
): UploadCapability {
  const local = globalThis as typeof globalThis & { __uploadRequestSecret?: string };
  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    (local.__uploadRequestSecret ??= randomBytes(32).toString("hex"));
  const token = createHmac("sha256", secret)
    .update(`booking-upload:${requestKey}`)
    .digest("base64url");
  return {
    token,
    hash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(now.getTime() + UPLOAD_CAPABILITY_TTL_SECONDS * 1000).toISOString(),
  };
}

/** Only the hash and expiry belong in persistence; the token stays in HttpOnly cookies. */
export function createUploadCapability(now = new Date()): UploadCapability {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(now.getTime() + UPLOAD_CAPABILITY_TTL_SECONDS * 1000).toISOString(),
  };
}

/** Pure verification, including legacy rows without a capability and exact expiry. */
export function verifyUploadCapability(
  token: string | undefined,
  storedHash: string | null,
  expiresAt: string | Date | null,
  now = new Date(),
): boolean {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  if (!storedHash || !/^[a-f0-9]{64}$/.test(storedHash) || !expiresAt) return false;
  const expires = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  if (!Number.isFinite(expires) || expires <= now.getTime()) return false;
  const actual = createHash("sha256").update(token).digest();
  return timingSafeEqual(actual, Buffer.from(storedHash, "hex"));
}

export function uploadCapabilityCookieName(bookingId: number, secure: boolean): string {
  return `${secure ? "__Host-" : ""}wg-upload-${bookingId}`;
}
