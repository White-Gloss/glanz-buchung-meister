import { createHash } from "node:crypto";
import { bookingDealBody } from "../src/lib/bitrix-sync.ts";

export function requireLegacy(condition, code) {
  if (!condition) throw new Error(code);
}

export function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

export const fingerprint = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)) ?? "undefined")
    .digest("hex");

export function moneyCents(value) {
  requireLegacy(
    (typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value)) ||
      (typeof value === "number" && Number.isFinite(value) && value >= 0),
    "invalid_legacy_money",
  );
  const cents = Math.round(Number(value) * 100);
  requireLegacy(
    Number.isSafeInteger(cents) && Math.abs(Number(value) * 100 - cents) < 0.000001,
    "invalid_legacy_money",
  );
  return cents;
}

function timestamp(value) {
  requireLegacy(
    typeof value === "string" &&
      /(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
      Number.isFinite(Date.parse(value)),
    "legacy_timezone_required",
  );
  return new Date(value).toISOString();
}

/** Preserve the inspected RO state; never infer consent, payment method or a new invoice. */
export function legacyPlan(record) {
  const { booking, order, items, photos } = record;
  requireLegacy(
    Number.isSafeInteger(booking?.id) && booking.id > 0 && booking.shop_id === "white-gloss",
    "invalid_legacy_booking",
  );
  requireLegacy(
    Number(order?.id) === Number(booking.ro_order_id) && Number(order.id) > 0,
    "legacy_identity_mismatch",
  );
  requireLegacy(
    Number.isSafeInteger(booking.version) && booking.version > 0,
    "invalid_legacy_version",
  );
  const states = {
    Akzeptiert: "EXECUTING",
    Erledigt: "FINAL_INVOICE",
    "In Rechnung gestellt": "FINAL_INVOICE",
  };
  const stage = states[order.status?.name];
  requireLegacy(stage, "legacy_status_needs_review");
  const amountCents = moneyCents(order.total);
  requireLegacy(
    amountCents === booking.total_cents &&
      (booking.agreed_price_cents == null || booking.agreed_price_cents === amountCents),
    "legacy_price_mismatch",
  );
  const paidCents = moneyCents(order.payed);
  requireLegacy(
    paidCents <= amountCents && moneyCents(order.discount_sum) === 0,
    "legacy_payment_or_discount_needs_review",
  );
  const start = timestamp(order.scheduled_for);
  const end = timestamp(order.scheduled_to);
  requireLegacy(Date.parse(end) > Date.parse(start), "invalid_legacy_interval");
  const rows = Array.isArray(items) ? items : items?.data;
  requireLegacy(Array.isArray(rows) && rows.length > 0, "legacy_items_missing");
  const products = rows.map((item) => {
    requireLegacy(
      typeof item.entity?.title === "string" &&
        item.entity.title.trim() &&
        Number(item.quantity) === 1 &&
        item.is_refunded === false,
      "legacy_item_needs_review",
    );
    requireLegacy(
      item.discount?.type === "percentage" &&
        Number(item.discount.percentage) === 0 &&
        moneyCents(item.discount.amount) === 0,
      "legacy_item_discount_needs_review",
    );
    requireLegacy(
      Array.isArray(item.taxes) &&
        (item.taxes.length === 0 || (item.taxes.length === 1 && Number(item.taxes[0].rate) === 19)),
      "legacy_item_tax_needs_review",
    );
    return {
      catalogId: `legacy-ro-${item.id}`,
      productId: 0,
      name: item.entity.title,
      price: moneyCents(item.price) / 100,
      taxRate: item.taxes.length ? 19 : 0,
    };
  });
  requireLegacy(
    products.reduce((sum, item) => sum + moneyCents(item.price), 0) === amountCents,
    "legacy_lines_total_mismatch",
  );
  requireLegacy(
    Array.isArray(photos) &&
      photos.every((photo) => photo.booking_id === booking.id && photo.upload_state === "ready"),
    "legacy_photos_not_ready",
  );
  const sourceDates = [order.done_at, order.closed_at].filter(Boolean).map(timestamp);
  const warnings = sourceDates.some((date) => date < start)
    ? ["source_completion_precedes_scheduled_date"]
    : [];
  const forTransfer = {
    ...booking,
    status: stage === "EXECUTING" ? "bestaetigt" : "erledigt",
    ops_stage: order.status.name,
    agreed_price_cents: amountCents,
    work_start_at: start,
    work_end_at: end,
  };
  const deal = bookingDealBody(forTransfer, 0);
  deal.stageId = stage;
  // Retain website context, but replace its obsolete invoice/payment summary with
  // the actual legacy source. Historical payment metadata is not a payment booking.
  deal.comments = deal.comments
    .split("\n")
    .filter((line) => !line.startsWith("Rechnungsstatus (Website):"))
    .concat([
      `Übernahme des bestehenden RO-Auftrags ${order.id}; Originalstatus: ${order.status.name}.`,
      `Zahlungsstand laut RO: ${(paidCents / 100).toFixed(2)} EUR von ${(amountCents / 100).toFixed(2)} EUR. Keine neue Zahlung gebucht.`,
      `RO-Abschlusszeit: ${order.done_at || "nicht gesetzt"}; geschlossen: ${order.closed_at || "nicht gesetzt"}.`,
      "Bestehende Belege bleiben unverändert. Diese Übernahme erstellt und versendet keine Rechnung oder Kundenbestätigung.",
      ...(warnings.length
        ? [
            "Quellkonflikt unverändert erhalten: RO-Abschlusszeit liegt vor dem gespeicherten Termin. Termin und Originalstatus manuell prüfen.",
          ]
        : []),
    ])
    .join("\n");
  deal.ufCrmWgServiceLines = products.map((p) => `${p.name}: ${p.price.toFixed(2)} EUR`).join("\n");
  return {
    bookingId: booking.id,
    orderId: Number(order.id),
    version: booking.version,
    amountCents,
    paidCents,
    start,
    end,
    stage,
    originalStatus: order.status.name,
    warnings,
    products,
    deal,
    photoCount: photos.length,
    forTransfer,
  };
}

export function assertLegacyBookingUnchanged(snapshot, current) {
  requireLegacy(current && current.id === snapshot.id, "legacy_booking_missing");
  const keys = Object.keys(current).filter((key) => !key.startsWith("bitrix_"));
  requireLegacy(
    keys.every((key) => fingerprint(current[key]) === fingerprint(snapshot[key])),
    "legacy_booking_changed",
  );
}
