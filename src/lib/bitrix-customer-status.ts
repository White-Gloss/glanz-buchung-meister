import type { BitrixCall } from "./bitrix-error.ts";

/** Called only after the website has authenticated the customer's booking token. */
export async function nativeCustomerStatus(request: BitrixCall, bookingId: number, dealId: number) {
  const deal = await request<Record<string, unknown>>("GET", `/deals/${dealId}`);
  if (Number(deal.ID) !== dealId || deal.UF_CRM_WG_BOOKING_REF !== `WG-${bookingId}`)
    throw new Error("Bitrix-Auftrag nicht eindeutig zugeordnet.");
  const stage = String(deal.STAGE_ID || "")
    .split(":")
    .at(-1)!;
  const labels: Record<string, string> = {
    NEW: "Anfrage eingegangen",
    PREPARATION: "Anfrage in Prüfung",
    PREPAYMENT_INVOICE: "Kundenzustimmung ausstehend",
    EXECUTING: "Termin bestätigt",
    FINAL_INVOICE: "Dienstleistung abgeschlossen",
    WON: "Auftrag abgeschlossen",
    LOSE: "Anfrage abgelehnt",
    APOLOGY: "Termin storniert",
  };
  const amount = Number(deal.OPPORTUNITY);
  if (
    !(
      typeof deal.OPPORTUNITY === "number" ||
      (typeof deal.OPPORTUNITY === "string" && deal.OPPORTUNITY.trim() !== "")
    ) ||
    deal.CURRENCY_ID !== "EUR" ||
    !Number.isFinite(amount) ||
    amount < 0
  )
    throw new Error("Bitrix-Preis nicht eindeutig lesbar.");
  const appointment =
    typeof deal.UF_CRM_WG_APPOINTMENT === "string" ? deal.UF_CRM_WG_APPOINTMENT : null;
  const hasAppointment = Boolean(appointment && Number.isFinite(Date.parse(appointment)));
  const fixed = ["EXECUTING", "FINAL_INVOICE", "WON"].includes(stage) && hasAppointment;
  return {
    status:
      stage === "EXECUTING" && !hasAppointment
        ? "In Bearbeitung – Termin noch offen"
        : labels[stage] || "Anfrage in Bearbeitung",
    amount: Math.round(amount * 100),
    fixed,
    scheduledFor:
      fixed && appointment && Number.isFinite(Date.parse(appointment))
        ? new Date(appointment).toISOString()
        : null,
  };
}
