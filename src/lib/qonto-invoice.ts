import {
  createAndFinalizeClientInvoice,
  findOrCreateQontoClient,
  qontoConfigured,
  qontoIban,
  sendClientInvoiceEmail,
  type QontoInvoiceLine,
} from "./qonto-mail.ts";

const PACKAGE_LABELS: Record<string, string> = {
  basis: "Basisreinigung",
  premium: "Reinigung & Politur",
  keramik: "Keramikschutz",
};

const EXTRA_LABELS: Record<string, string> = {
  felgen: "Felgenreinigung und Versiegelung",
  ozon: "Geruchsbehandlung mit Ozon",
  motor: "Motorraumreinigung",
  leder: "Lederpflege",
  alcantara: "Alcantarareinigung",
  dachhimmel: "Dachhimmelreinigung",
  scheinwerfer: "Scheinwerferaufbereitung",
  glas: "Scheibenversiegelung",
  "keramik-ultra": "Zusätzliche Keramikschichten",
  cabrio: "Cabrioverdeckpflege",
  tierhaar: "Tierhaarentfernung",
  "leder-repair": "Lederreparatur",
  "stoff-loch": "Textilreparatur",
};

function isEmailAddress(value: string | null | undefined): value is string {
  if (!value) return false;
  const v = value.trim();
  return v.length > 3 && v.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

type Sql = Awaited<ReturnType<typeof import("./db").getSql>>;

const SHOP = "white-gloss";
const VAT_RATE = "0.19";
const VAT_FACTOR = 1.19;

export type QontoBookingFields = {
  id: number;
  customer_name: string;
  email: string | null;
  package_id: string;
  extra_ids?: string | null;
  total_cents: number;
  pickup_cents: number;
  qonto_client_id?: string | null;
  qonto_invoice_id?: string | null;
  qonto_invoice_number?: string | null;
  qonto_invoice_status?: string | null;
};

export type QontoInvoiceDeps = {
  configured?: () => boolean;
  iban?: () => string;
  findOrCreateClient?: typeof findOrCreateQontoClient;
  createAndFinalize?: typeof createAndFinalizeClientInvoice;
  sendEmail?: typeof sendClientInvoiceEmail;
};

function parseExtraIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function eurosFromGrossCents(cents: number): string {
  const net = cents / 100 / VAT_FACTOR;
  return net.toFixed(2);
}

function truncateTitle(title: string): string {
  return title.trim().slice(0, 40);
}

export function buildInvoiceLinesFromBooking(input: {
  customer_name?: string;
  email?: string | null;
  package_id: string;
  package_name?: string;
  extra_names?: string[];
  extra_ids?: string | null;
  total_cents: number;
  pickup_cents: number;
}): QontoInvoiceLine[] {
  const pickup = Math.max(0, input.pickup_cents | 0);
  const total = Math.max(0, input.total_cents | 0);
  const serviceCents = Math.max(0, total - pickup);
  const pack =
    input.package_name ||
    PACKAGE_LABELS[input.package_id] ||
    input.package_id;
  const extraNames =
    input.extra_names ||
    parseExtraIds(input.extra_ids).map((id) => EXTRA_LABELS[id] || id);

  const lines: QontoInvoiceLine[] = [];
  if (serviceCents > 0) {
    const titleParts = [pack, ...extraNames];
    lines.push({
      title: truncateTitle(titleParts.join(" · ") || "Detailing"),
      quantity: "1",
      unit: "unit",
      unit_price: { value: eurosFromGrossCents(serviceCents), currency: "EUR" },
      vat_rate: VAT_RATE,
      description: extraNames.length ? `Extras: ${extraNames.join(", ")}` : undefined,
    });
  }
  if (pickup > 0) {
    lines.push({
      title: truncateTitle("Abholung / Bring-Service"),
      quantity: "1",
      unit: "unit",
      unit_price: { value: eurosFromGrossCents(pickup), currency: "EUR" },
      vat_rate: VAT_RATE,
    });
  }
  if (lines.length === 0) {
    lines.push({
      title: truncateTitle(pack || "Detailing"),
      quantity: "1",
      unit: "unit",
      unit_price: { value: "0.00", currency: "EUR" },
      vat_rate: VAT_RATE,
    });
  }
  return lines;
}

function berlinDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function markFailed(sql: Sql, bookingId: number, error: string) {
  const statusFailed = "failed";
  await sql`
    update bookings
    set qonto_invoice_status = ${statusFailed},
        qonto_invoice_error = ${error.slice(0, 500)},
        updated_at = now()
    where id = ${bookingId} and shop_id = ${SHOP}
  `;
}

export async function ensureQontoInvoiceForBooking(
  sql: Sql,
  booking: QontoBookingFields,
  deps: QontoInvoiceDeps = {},
): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  if (booking.qonto_invoice_id) {
    return { ok: true, invoiceId: booking.qonto_invoice_id };
  }

  const configured = deps.configured ?? qontoConfigured;
  if (!configured()) {
    const error =
      "Qonto ist nicht konfiguriert (QONTO_LOGIN / QONTO_SECRET_KEY / QONTO_IBAN).";
    await markFailed(sql, booking.id, error);
    return { ok: false, error };
  }

  if (!isEmailAddress(booking.email)) {
    const error =
      "Kunden-E-Mail fehlt – Qonto-Rechnung kann nicht erstellt werden.";
    await markFailed(sql, booking.id, error);
    return { ok: false, error };
  }

  const findOrCreate = deps.findOrCreateClient ?? findOrCreateQontoClient;
  const createAndFinalize = deps.createAndFinalize ?? createAndFinalizeClientInvoice;
  const ibanFn = deps.iban ?? qontoIban;

  try {
    const statusPending = "pending";
    await sql`
      update bookings
      set qonto_invoice_status = ${statusPending},
          qonto_invoice_error = null,
          updated_at = now()
      where id = ${booking.id} and shop_id = ${SHOP}
    `;

    const client = await findOrCreate({
      name: booking.customer_name,
      email: booking.email,
      currency: "EUR",
    });

    const items = buildInvoiceLinesFromBooking({
      package_id: booking.package_id,
      extra_ids: booking.extra_ids,
      total_cents: booking.total_cents,
      pickup_cents: booking.pickup_cents,
    });

    const invoice = await createAndFinalize({
      clientId: client.id,
      issueDate: berlinDate(0),
      dueDate: berlinDate(14),
      currency: "EUR",
      iban: ibanFn(),
      items,
    });

    const statusUnpaid = "unpaid";
    const invoiceNumber = invoice.invoice_number || null;
    await sql`
      update bookings
      set qonto_client_id = ${client.id},
          qonto_invoice_id = ${invoice.id},
          qonto_invoice_number = ${invoiceNumber},
          qonto_invoice_status = ${statusUnpaid},
          qonto_invoice_error = null,
          updated_at = now()
      where id = ${booking.id} and shop_id = ${SHOP}
    `;

    return { ok: true, invoiceId: invoice.id };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Qonto-Rechnung konnte nicht erstellt werden.";
    console.error("[qonto-invoice] ensure failed", message.slice(0, 300));
    await markFailed(sql, booking.id, message);
    return { ok: false, error: message };
  }
}

export async function sendQontoInvoiceEmailForBooking(
  sql: Sql,
  bookingId: number,
  deps: QontoInvoiceDeps = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await sql<QontoBookingFields>`
    select id, customer_name, email, package_id, extra_ids, total_cents, pickup_cents,
           qonto_client_id, qonto_invoice_id, qonto_invoice_number, qonto_invoice_status
    from bookings
    where id = ${bookingId} and shop_id = ${SHOP}
    limit 1
  `;
  const booking = rows[0];
  if (!booking) return { ok: false, error: "Buchung nicht gefunden." };

  if (!booking.qonto_invoice_id) {
    return {
      ok: false,
      error: "Keine Qonto-Rechnung vorhanden. Bitte zuerst erstellen.",
    };
  }
  if (!isEmailAddress(booking.email)) {
    const error = "Kunden-E-Mail fehlt – Versand nicht möglich.";
    await markFailed(sql, booking.id, error);
    return { ok: false, error };
  }

  const configured = deps.configured ?? qontoConfigured;
  if (!configured()) {
    const error =
      "Qonto ist nicht konfiguriert (QONTO_LOGIN / QONTO_SECRET_KEY / QONTO_IBAN).";
    await markFailed(sql, booking.id, error);
    return { ok: false, error };
  }

  const sendEmail = deps.sendEmail ?? sendClientInvoiceEmail;
  try {
    await sendEmail({
      invoiceId: booking.qonto_invoice_id,
      recipientEmail: booking.email,
      emailTitle: `Rechnung ${booking.qonto_invoice_number || ""} · White Gloss`.trim(),
    });
    const statusSent = "sent";
    await sql`
      update bookings
      set qonto_invoice_status = ${statusSent},
          qonto_sent_at = now(),
          qonto_invoice_error = null,
          updated_at = now()
      where id = ${booking.id} and shop_id = ${SHOP}
    `;
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Qonto-Rechnung konnte nicht versendet werden.";
    console.error("[qonto-invoice] send failed", message.slice(0, 300));
    await markFailed(sql, booking.id, message);
    return { ok: false, error: message };
  }
}
