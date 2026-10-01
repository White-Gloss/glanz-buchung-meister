import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Qonto signiert so:
 *
 *   HMAC_SHA256(secret,  "{unix-timestamp}.{roher-body}")
 *
 * Header:
 *   X-Qonto-Signature: t=1704110400,v1=<64 hex>
 *
 * Der Punkt gehört zur signierten Nachricht.
 * Der Body muss bytegleich sein – kein JSON.stringify danach.
 */
export const QONTO_SIGNATURE_HEADER = "x-qonto-signature";
export const QONTO_MAX_SKEW_SECONDS = 300;
export const QONTO_SIGNATURE_HEX_LENGTH = 64;

export type QontoSignatureErrorCode =
  | "missing_header"
  | "malformed_header"
  | "timestamp_expired"
  | "timestamp_future"
  | "invalid_signature";

export class QontoSignatureError extends Error {
  readonly code: QontoSignatureErrorCode;

  constructor(code: QontoSignatureErrorCode, message: string) {
    super(message);
    this.name = "QontoSignatureError";
    this.code = code;
  }
}

export type VerifyQontoSignatureInput = {
  rawBody: Buffer | Uint8Array | string;
  signatureHeader: string | null | undefined;
  secret: string;
  nowSeconds?: number;
  maxSkewSeconds?: number;
};

export type ParsedQontoSignature = {
  timestamp: number;
  timestampRaw: string;
  signaturesHex: string[];
};

function toBuffer(rawBody: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(rawBody)) return rawBody;
  if (typeof rawBody === "string") return Buffer.from(rawBody, "utf8");
  return Buffer.from(rawBody);
}

function isSha256Hex(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

export function parseQontoSignatureHeader(header: string): ParsedQontoSignature {
  const parts = header.split(",");
  let timestampRaw: string | undefined;
  const signaturesHex: string[] = [];

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestampRaw = value;
    if (key === "v1" && isSha256Hex(value)) {
      signaturesHex.push(value.toLowerCase());
    }
  }

  if (!timestampRaw || !/^\d+$/.test(timestampRaw)) {
    throw new QontoSignatureError("malformed_header", "X-Qonto-Signature braucht t={unixsekunden}");
  }

  if (signaturesHex.length === 0) {
    throw new QontoSignatureError(
      "malformed_header",
      "X-Qonto-Signature braucht mindestens ein v1={64 hex}",
    );
  }

  return {
    timestamp: Number(timestampRaw),
    timestampRaw,
    signaturesHex,
  };
}

export function signedQontoMessage(timestampRaw: string, rawBody: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`${timestampRaw}.`, "utf8"), rawBody]);
}

export function computeQontoSignatureHex(
  secret: string,
  timestampRaw: string,
  rawBody: Buffer,
): string {
  return createHmac("sha256", secret)
    .update(signedQontoMessage(timestampRaw, rawBody))
    .digest("hex");
}

export function signQontoPayload(input: {
  rawBody: Buffer | Uint8Array | string;
  secret: string;
  timestamp?: number;
}): { header: string; timestamp: number; digestHex: string } {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const timestampRaw = String(timestamp);
  const digestHex = computeQontoSignatureHex(input.secret, timestampRaw, toBuffer(input.rawBody));
  return {
    timestamp,
    digestHex,
    header: `t=${timestampRaw},v1=${digestHex}`,
  };
}

function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== QONTO_SIGNATURE_HEX_LENGTH / 2) return false;
  if (b.length !== a.length) return false;
  return timingSafeEqual(a, b);
}

function anySignatureMatches(expectedHex: string, candidates: string[]): boolean {
  let matched = false;
  for (const candidate of candidates) {
    if (timingSafeHexEqual(expectedHex, candidate)) matched = true;
  }
  return matched;
}

function assertFreshTimestamp(timestamp: number, nowSeconds: number, maxSkewSeconds: number): void {
  const delta = nowSeconds - timestamp;
  if (delta > maxSkewSeconds) {
    throw new QontoSignatureError(
      "timestamp_expired",
      "Webhook-Zeitstempel älter als 5 Minuten (Replay)",
    );
  }
  if (delta < -maxSkewSeconds) {
    throw new QontoSignatureError(
      "timestamp_future",
      "Webhook-Zeitstempel liegt zu weit in der Zukunft",
    );
  }
}

export function verifyQontoSignature(input: VerifyQontoSignatureInput): {
  timestamp: number;
} {
  const header = input.signatureHeader?.trim();
  if (!header) {
    throw new QontoSignatureError("missing_header", "Header X-Qonto-Signature fehlt");
  }
  if (!input.secret) {
    throw new QontoSignatureError("invalid_signature", "QONTO_WEBHOOK_SECRET fehlt");
  }

  const parsed = parseQontoSignatureHeader(header);
  assertFreshTimestamp(
    parsed.timestamp,
    input.nowSeconds ?? Math.floor(Date.now() / 1000),
    input.maxSkewSeconds ?? QONTO_MAX_SKEW_SECONDS,
  );

  const expected = computeQontoSignatureHex(
    input.secret,
    parsed.timestampRaw,
    toBuffer(input.rawBody),
  );

  if (!anySignatureMatches(expected, parsed.signaturesHex)) {
    throw new QontoSignatureError(
      "invalid_signature",
      "HMAC stimmt nicht – Secret, Body oder Header falsch",
    );
  }

  return { timestamp: parsed.timestamp };
}
