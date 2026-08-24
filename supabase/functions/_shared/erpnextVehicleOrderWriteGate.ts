export const VEHICLE_ORDER_WRITE_CONFIRMATION_VERSION = "WGVO3";
export const VEHICLE_ORDER_WRITE_CONFIRMATION_TTL_SECONDS = 5 * 60;

const CONFIRMATION_CLOCK_SKEW_SECONDS = 30;

type GateStatusInput = {
  enabledValue?: string | null;
  approvedBookingId?: string | null;
  bookingId: string;
};

type GateEvaluationInput = GateStatusInput & {
  confirmationValid: boolean;
};

type ConfirmationPayload = {
  version: typeof VEHICLE_ORDER_WRITE_CONFIRMATION_VERSION;
  bookingId: string;
  bookingRevision: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

type IssueConfirmationInput = {
  secret: string;
  bookingId: string;
  bookingRevision: string;
  nowMs?: number;
  nonce?: string;
};

type VerifyConfirmationInput = {
  secret: string;
  bookingId: string;
  bookingRevision: string;
  confirmation?: unknown;
  nowMs?: number;
};

export type VehicleOrderWriteGateStatus = {
  enabled: boolean;
  bookingApproved: boolean;
  ready: boolean;
};

export type VehicleOrderWriteGateEvaluation = VehicleOrderWriteGateStatus & {
  confirmationValid: boolean;
  error:
    | "production_write_gate_disabled"
    | "production_write_booking_not_approved"
    | "explicit_write_confirmation_required"
    | null;
};

const normalize = (value?: string | null) => value?.trim() ?? "";
const encoder = new TextEncoder();

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = (value: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_base64url");
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat(
    (4 - (value.length % 4)) % 4,
  )}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const importHmacKey = (secret: string) =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

export async function issueVehicleOrderWriteConfirmation({
  secret,
  bookingId,
  bookingRevision,
  nowMs = Date.now(),
  nonce = crypto.randomUUID(),
}: IssueConfirmationInput) {
  if (!secret.trim() || !bookingId.trim() || !bookingRevision.trim() || !nonce.trim()) {
    throw new Error("invalid_confirmation_input");
  }

  const issuedAt = Math.floor(nowMs / 1_000);
  const payload: ConfirmationPayload = {
    version: VEHICLE_ORDER_WRITE_CONFIRMATION_VERSION,
    bookingId,
    bookingRevision,
    issuedAt,
    expiresAt: issuedAt + VEHICLE_ORDER_WRITE_CONFIRMATION_TTL_SECONDS,
    nonce,
  };
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));

  return `${VEHICLE_ORDER_WRITE_CONFIRMATION_VERSION}.${encodedPayload}.${bytesToBase64Url(
    new Uint8Array(signature),
  )}`;
}

export async function verifyVehicleOrderWriteConfirmation({
  secret,
  bookingId,
  bookingRevision,
  confirmation,
  nowMs = Date.now(),
}: VerifyConfirmationInput) {
  if (
    !secret.trim() ||
    !bookingId.trim() ||
    !bookingRevision.trim() ||
    typeof confirmation !== "string"
  ) {
    return false;
  }

  try {
    const [version, encodedPayload, encodedSignature, ...rest] = confirmation.split(".");
    if (
      rest.length > 0 ||
      version !== VEHICLE_ORDER_WRITE_CONFIRMATION_VERSION ||
      !encodedPayload ||
      !encodedSignature
    ) {
      return false;
    }

    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload))) as Partial<
      ConfirmationPayload
    >;
    const nowSeconds = Math.floor(nowMs / 1_000);
    const payloadValid =
      parsed.version === VEHICLE_ORDER_WRITE_CONFIRMATION_VERSION &&
      parsed.bookingId === bookingId &&
      parsed.bookingRevision === bookingRevision &&
      Number.isInteger(parsed.issuedAt) &&
      Number.isInteger(parsed.expiresAt) &&
      typeof parsed.nonce === "string" &&
      parsed.nonce.length >= 16 &&
      (parsed.issuedAt as number) <= nowSeconds + CONFIRMATION_CLOCK_SKEW_SECONDS &&
      (parsed.expiresAt as number) - (parsed.issuedAt as number) ===
        VEHICLE_ORDER_WRITE_CONFIRMATION_TTL_SECONDS &&
      nowSeconds < (parsed.expiresAt as number);
    if (!payloadValid) return false;

    const key = await importHmacKey(secret);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(encodedSignature),
      encoder.encode(encodedPayload),
    );
  } catch {
    return false;
  }
}

export function getVehicleOrderWriteGateStatus({
  enabledValue,
  approvedBookingId,
  bookingId,
}: GateStatusInput): VehicleOrderWriteGateStatus {
  const enabled = normalize(enabledValue).toLowerCase() === "true";
  const bookingApproved =
    normalize(approvedBookingId).length > 0 && normalize(approvedBookingId) === bookingId;

  return {
    enabled,
    bookingApproved,
    ready: enabled && bookingApproved,
  };
}

export function evaluateVehicleOrderWriteGate({
  confirmationValid,
  ...statusInput
}: GateEvaluationInput): VehicleOrderWriteGateEvaluation {
  const status = getVehicleOrderWriteGateStatus(statusInput);
  const evaluation = {
    ...status,
    ready: status.ready && confirmationValid,
    confirmationValid,
  };

  if (!status.enabled) {
    return { ...evaluation, error: "production_write_gate_disabled" };
  }
  if (!status.bookingApproved) {
    return {
      ...evaluation,
      error: "production_write_booking_not_approved",
    };
  }
  if (!confirmationValid) {
    return {
      ...evaluation,
      error: "explicit_write_confirmation_required",
    };
  }

  return { ...evaluation, error: null };
}
