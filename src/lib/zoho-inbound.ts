import { createHmac, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db.ts";
import {
  completeServiceWithPayment,
  confirmBookingWithSchedule,
  rejectOrCancelBooking,
  type ConfirmScheduleInput,
  type CompleteInput,
} from "./zoho-ops.ts";
import { requireBookingOwner } from "./booking-owner.ts";

const SHOP = "white-gloss";

export function zohoWebhookSecret() {
  return (process.env.ZOHO_WEBHOOK_SECRET || "").trim();
}

export async function resolveZohoWebhookSecret(sql: Sql) {
  const fromEnv = zohoWebhookSecret();
  if (fromEnv.length >= 24) return fromEnv;
  const [row] = await sql<{ zoho_webhook_secret: string | null }>`
    select zoho_webhook_secret from shop_settings where shop_id = ${SHOP}
  `.catch(() => []);
  return row?.zoho_webhook_secret?.trim() || "";
}

export function zohoWebhookAuthorized(header: string | null, queryToken: string | null, secret = zohoWebhookSecret()) {
  if (!secret || secret.length < 24) return false;
  const provided = (header?.replace(/^Bearer\s+/i, "") || queryToken || "").trim();
  if (!provided) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(provided);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function zohoWebhookSignature(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

type InboundAction =
  | "confirm"
  | "reject"
  | "cancel"
  | "complete"
  | "sync"
  | "deal_update";

export type ZohoInboundPayload = {
  action?: InboundAction;
  bookingId?: number;
  reference?: string;
  expectedVersion?: number;
  actor?: string;
  dealId?: string;
  stage?: string;
  confirm?: ConfirmScheduleInput;
  complete?: CompleteInput;
};

async function resolveBookingId(sql: Sql, payload: ZohoInboundPayload) {
  if (payload.bookingId && Number.isInteger(payload.bookingId)) return payload.bookingId;
  const ref = (payload.reference || "").trim();
  const match = /^WG-(\d+)$/i.exec(ref);
  if (match) return Number(match[1]);
  if (payload.dealId) {
    const [row] = await sql<{ id: number }>`
      select id from bookings where shop_id = ${SHOP} and zoho_deal_id = ${payload.dealId} limit 1
    `;
    if (row) return row.id;
  }
  throw new Error("Buchung nicht eindeutig zuordenbar.");
}

export async function handleZohoInbound(
  sql: Sql,
  payload: ZohoInboundPayload,
  actorFallback: string,
) {
  const actor = (payload.actor || actorFallback).trim();
  if (!actor) throw new Error("Akteur fehlt.");
  await requireBookingOwner(sql, actor);
  const id = await resolveBookingId(sql, payload);
  const [row] = await sql<{ version: number; status: string }>`
    select version, status from bookings where shop_id = ${SHOP} and id = ${id}
  `;
  if (!row) throw new Error("Buchung nicht gefunden.");
  const expected = payload.expectedVersion ?? row.version;
  const action = payload.action || "sync";
  if (action === "confirm") {
    if (!payload.confirm) throw new Error("Bestätigung braucht Zeitraum und Preis.");
    return confirmBookingWithSchedule(sql, id, expected, actor, payload.confirm);
  }
  if (action === "reject") return rejectOrCancelBooking(sql, id, expected, actor, "abgelehnt");
  if (action === "cancel") return rejectOrCancelBooking(sql, id, expected, actor, "storniert");
  if (action === "complete") {
    if (!payload.complete) throw new Error("Abschluss braucht eine Zahlungsvariante.");
    return completeServiceWithPayment(sql, id, expected, actor, payload.complete);
  }
  return { bookingId: id, changed: false, action };
}
