import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "./db.ts";
import { roappAccountScope, roappOnlyEnabled } from "./booking-backend.ts";
import { berlinCalendarDate, isCalendarDate } from "./calendar-date.ts";
import { createBusinessDocumentPdf, type DocumentRow } from "./document-pdf.ts";
import { documentLogoBase64 } from "./document-logo.generated.ts";
import { enqueueNotification } from "./booking-notifications.ts";
import { bookingOwnerNotifyTargets } from "./ops.ts";
import { journalRoappWrites } from "./roapp-write-journal.ts";
import {
  createOrderComment,
  createRoappClient,
  getOrderLines,
  roappCredentialsFromEnv,
  RoappError,
  type RoappOrderLine,
  type RoappRequest,
} from "./roapp.ts";
import { currentRoContact } from "./roapp-contact.ts";
import { site, vehicleClasses } from "../data/site.ts";

/** Customer invoice and cash receipt produced after RO completion. */
export const RO_INVOICE = "wg.ro.invoice";
export const RO_RECEIPT = "wg.ro.receipt";
export const RO_OWNER = "wg.ro.owner";
const SHOP = "white-gloss";
const DAY = 86_400_000;
/** §33 UStDV: above this gross amount the recipient's full name and address are mandatory. */
export const SMALL_INVOICE_LIMIT_CENTS = 25_000;

export type RoInvoiceConfig = {
  from: string;
  delayMinutes: number;
  bank: { holder: string; name: string; iban: string; bic: string };
  taxNumber: string | null;
};

export function roInvoiceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return roappOnlyEnabled() && env.ROAPP_INVOICE_ENABLED?.trim() === "true";
}

export function validIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("DE") && iban.length !== 22) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );
  let rest = 0;
  for (const digit of digits) rest = (rest * 10 + Number(digit)) % 97;
  return rest === 1;
}

/** Never returns configured values in problems: bank data stays in the protected environment. */
export function roInvoiceConfig(env: NodeJS.ProcessEnv = process.env): {
  config: RoInvoiceConfig | null;
  problems: string[];
} {
  const value = (key: string) => env[key]?.trim() || "";
  const problems: string[] = [];
  const from = value("ROAPP_INVOICE_FROM");
  if (
    !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(from) ||
    !Number.isFinite(Date.parse(from))
  )
    problems.push("ROAPP_INVOICE_FROM muss der Startzeitpunkt der Rechnungsautomatik sein.");
  const delayRaw = value("ROAPP_INVOICE_DELAY_MINUTES") || "15";
  const delayMinutes = Number(delayRaw);
  if (!/^\d{1,4}$/.test(delayRaw) || delayMinutes > 1440)
    problems.push("ROAPP_INVOICE_DELAY_MINUTES muss zwischen 0 und 1440 liegen.");
  const holder = value("ROAPP_INVOICE_BANK_HOLDER");
  const name = value("ROAPP_INVOICE_BANK_NAME");
  const iban = value("ROAPP_INVOICE_IBAN").replace(/\s+/g, "").toUpperCase();
  const bic = value("ROAPP_INVOICE_BIC").replace(/\s+/g, "").toUpperCase();
  if (!holder || holder.length > 120) problems.push("ROAPP_INVOICE_BANK_HOLDER fehlt.");
  if (!name || name.length > 120) problems.push("ROAPP_INVOICE_BANK_NAME fehlt.");
  if (!validIban(iban)) problems.push("ROAPP_INVOICE_IBAN ist keine gültige IBAN.");
  if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic))
    problems.push("ROAPP_INVOICE_BIC ist keine gültige BIC.");
  const taxNumber = value("ROAPP_INVOICE_TAX_NUMBER") || null;
  if (taxNumber && !/^[0-9][0-9 /-]{7,20}$/.test(taxNumber))
    problems.push("ROAPP_INVOICE_TAX_NUMBER hat kein gültiges Format.");
  if (!/^DE\d{9}$/.test(site.vatId)) problems.push("Die USt-IdNr. der Website ist ungültig.");
  if (problems.length) return { config: null, problems };
  return {
    config: {
      from: new Date(from).toISOString(),
      delayMinutes,
      bank: { holder, name, iban, bic },
      taxNumber,
    },
    problems,
  };
}

const schemaReady = new WeakMap<Sql, Promise<void>>();
/** Additive DDL, identical to migrations/0023_roapp_invoices.sql. GitHub CI cannot
 * migrate the IONOS database, so the release gate does not require that file. */
export function ensureRoInvoiceSchema(sql: Sql): Promise<void> {
  const known = schemaReady.get(sql);
  if (known) return known;
  const ready = (async () => {
    await sql`create table if not exists roapp_invoices (
      booking_id integer primary key references bookings(id),
      shop_id text not null default 'white-gloss',
      account_scope text not null,
      ro_order_id integer not null,
      status text not null default 'geplant' check (status in ('geplant','wartet','in_arbeit','ausgestellt','versendet','pruefung','verworfen')),
      reason text,
      completed_at timestamptz not null,
      due_at timestamptz not null,
      attempts integer not null default 0,
      lease_token text,
      locked_until timestamptz,
      invoice_number text unique,
      issued_on date,
      service_from date,
      service_to date,
      payment_due_on date,
      gross_cents integer check (gross_cents >= 0),
      net_cents integer,
      vat_cents integer,
      recipient_email text,
      recipient jsonb,
      lines jsonb,
      pdf_base64 text,
      delivery text check (delivery in ('email','inhaber')),
      sent_at timestamptz,
      paid_cents integer not null default 0 check (paid_cents >= 0),
      payment_status text not null default 'offen' check (payment_status in ('offen','teilbezahlt','bezahlt')),
      paid_on date,
      ro_comment_state text not null default 'offen' check (ro_comment_state in ('offen','erledigt','pruefung')),
      attention text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check (status not in ('ausgestellt','versendet') or (invoice_number is not null and pdf_base64 is not null and gross_cents is not null)),
      check (paid_cents <= coalesce(gross_cents, 0))
    )`;
    await sql`create index if not exists roapp_invoices_due_idx on roapp_invoices(status, due_at)`;
    await sql`create table if not exists roapp_invoice_numbers (
      year integer primary key,
      last_value integer not null check (last_value > 0)
    )`;
    await sql`create table if not exists roapp_invoice_payments (
      id serial primary key,
      invoice_number text not null references roapp_invoices(invoice_number),
      request_id uuid not null,
      amount_cents integer not null check (amount_cents > 0),
      method text not null check (method in ('bar','ueberweisung')),
      paid_on date not null,
      recorded_by text not null,
      receipt_number text unique,
      receipt_pdf_base64 text,
      created_at timestamptz not null default now(),
      unique (invoice_number, request_id)
    )`;
    // Same DDL as the migration file: record it so history and db:migrate agree.
    const [registry] = await sql<{ present: boolean }>`
      select to_regclass('_migrations') is not null as present`;
    if (registry?.present)
      await sql`insert into _migrations(name) values('0023_roapp_invoices.sql') on conflict do nothing`;
  })().catch((error) => {
    schemaReady.delete(sql);
    throw error;
  });
  schemaReady.set(sql, ready);
  return ready;
}

/** Read paths never create tables: a paused automation still shows issued invoices. */
async function invoiceTablesExist(sql: Sql) {
  const [row] = await sql<{ present: boolean }>`
    select to_regclass('roapp_invoice_payments') is not null as present`;
  return Boolean(row?.present);
}

function stamp(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}
export function roInvoiceMessageKey(
  bookingId: number,
  kind: "invoice" | "receipt",
  number: string,
) {
  return `wg-ro-v1:${roappAccountScope()}:${bookingId}:${kind}:${stamp(number)}`;
}
function ownerKey(bookingId: number, topic: string, detail: string) {
  return `wg-ro-v1:${roappAccountScope()}:${bookingId}:owner:${topic}-${stamp(detail)}`;
}

/** Only invoice/receipt messages of the active account pass the customer-mail policy.
 * Pausing the automation stops invoice mail; receipts for recorded cash stay deliverable. */
export function approvedRoInvoiceMessage(key: string, event: string): boolean {
  if (!roappOnlyEnabled() || ![RO_INVOICE, RO_RECEIPT].includes(event)) return false;
  if (event === RO_INVOICE && !roInvoiceEnabled()) return false;
  const parts = key.split(":");
  return (
    parts.length === 5 &&
    parts[0] === "wg-ro-v1" &&
    parts[1] === roappAccountScope() &&
    /^[1-9][0-9]*$/.test(parts[2]) &&
    parts[3] === (event === RO_INVOICE ? "invoice" : "receipt") &&
    /^[a-f0-9]{20}$/.test(parts[4])
  );
}

export const euro = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const germanDate = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
};
function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Identical rounding to the PDF table: net per gross line, VAT as remainder. */
export function invoiceTotals(lines: RoappOrderLine[]) {
  let net = 0;
  let gross = 0;
  for (const line of lines) {
    gross += line.grossCents;
    net += Math.round(line.grossCents / 1.19);
  }
  return { gross, net, vat: gross - net };
}

export function invoiceNumber(year: number, sequence: number) {
  return `WG-RE-${year}-${String(sequence).padStart(4, "0")}`;
}

type Recipient = { name: string; address: string | null; email: string | null };

export async function renderRoInvoicePdf(input: {
  number: string;
  bookingId: number;
  issuedOn: string;
  serviceFrom: string;
  serviceTo: string;
  dueOn: string;
  recipient: Recipient;
  vehicle: string;
  lines: RoappOrderLine[];
  config: RoInvoiceConfig;
}) {
  const totals = invoiceTotals(input.lines);
  const rows: DocumentRow[] = input.lines.map((line) => ({
    name: line.name,
    quantity: line.quantity,
    grossCents: line.grossCents,
    taxRate: 19,
  }));
  const service =
    input.serviceFrom === input.serviceTo
      ? `Leistungsdatum: ${germanDate(input.serviceTo)}`
      : `Leistungszeitraum: ${germanDate(input.serviceFrom)} – ${germanDate(input.serviceTo)}`;
  return createBusinessDocumentPdf({
    title: "Rechnung",
    reference: input.number,
    logo: documentLogoBase64,
    company: `${site.legalName} · Inhaber ${site.owner}`,
    address: `${site.street}, ${site.postalCode} ${site.city}`,
    email: site.bookingEmail,
    customer: [input.recipient.name, input.recipient.address || "", input.recipient.email || ""],
    metadata: [
      `Rechnungsnummer: ${input.number}`,
      `Rechnungsdatum: ${germanDate(input.issuedOn)}`,
      service,
      `Zahlbar bis: ${germanDate(input.dueOn)}`,
      `Vorgang: WG-${input.bookingId}`,
    ],
    introduction: "Für die folgenden vollständig erbrachten Leistungen berechnen wir:",
    vehicle: input.vehicle,
    rows,
    amountCents: totals.gross,
    details: [
      `Bitte überweise ${euro(totals.gross)} bis zum ${germanDate(input.dueOn)} (Zahlungsziel: sieben Kalendertage ab Rechnungsdatum) unter Angabe der Rechnungsnummer ${input.number}.`,
      `Kontoinhaber: ${input.config.bank.holder} · Bank: ${input.config.bank.name} · IBAN: ${input.config.bank.iban.replace(/(.{4})/g, "$1 ").trim()} · BIC: ${input.config.bank.bic}`,
      `Umsatzsteuer-Identifikationsnummer: ${site.vatId}${input.config.taxNumber ? ` · Steuernummer: ${input.config.taxNumber}` : ""}. Alle Beträge enthalten 19 % Umsatzsteuer.`,
      "Als bezahlt gilt die Rechnung erst mit dem tatsächlichen Zahlungseingang. Bei Barzahlung erhältst du nach Erfassung eine gesonderte Quittung.",
    ],
    footerRight: [
      "white-gloss.de",
      `USt-IdNr. ${site.vatId}`,
      input.config.taxNumber ? `Steuernummer ${input.config.taxNumber}` : "",
      `Rechnung ${input.number}`,
    ].filter(Boolean),
  });
}

async function renderReceiptPdf(input: {
  receiptNumber: string;
  invoiceNumber: string;
  bookingId: number;
  recipient: Recipient;
  amountCents: number;
  paidOn: string;
  openCents: number;
  config: RoInvoiceConfig | null;
}) {
  return createBusinessDocumentPdf({
    title: "Quittung",
    reference: input.receiptNumber,
    logo: documentLogoBase64,
    company: `${site.legalName} · Inhaber ${site.owner}`,
    address: `${site.street}, ${site.postalCode} ${site.city}`,
    email: site.bookingEmail,
    customer: [input.recipient.name, input.recipient.address || "", input.recipient.email || ""],
    metadata: [
      `Quittung: ${input.receiptNumber}`,
      `Zur Rechnung: ${input.invoiceNumber}`,
      `Zahlungseingang: ${germanDate(input.paidOn)}`,
      `Vorgang: WG-${input.bookingId}`,
    ],
    introduction: `Wir bestätigen den Erhalt der folgenden Barzahlung zur Rechnung ${input.invoiceNumber}:`,
    vehicle: "",
    rows: [
      {
        name: `Barzahlung zu Rechnung ${input.invoiceNumber}`,
        quantity: 1,
        grossCents: input.amountCents,
        taxRate: 19,
      },
    ],
    amountCents: input.amountCents,
    details: [
      `Betrag in bar erhalten am ${germanDate(input.paidOn)}: ${euro(input.amountCents)}.`,
      input.openCents > 0
        ? `Offener Restbetrag der Rechnung: ${euro(input.openCents)}.`
        : "Die Rechnung ist damit vollständig bezahlt.",
      `Umsatzsteuer-Identifikationsnummer: ${site.vatId}${input.config?.taxNumber ? ` · Steuernummer: ${input.config.taxNumber}` : ""}.`,
    ],
    footerRight: ["white-gloss.de", `USt-IdNr. ${site.vatId}`, `Quittung ${input.receiptNumber}`],
  });
}

export function invoiceEmailBody(input: {
  name: string;
  number: string;
  bookingId: number;
  grossCents: number;
  dueOn: string;
}) {
  return [
    `Hallo ${input.name},`,
    "",
    `vielen Dank für deinen Auftrag WG-${input.bookingId} bei White Gloss Detailing. Im Anhang findest du die Rechnung ${input.number} über ${euro(input.grossCents)} als PDF.`,
    "",
    `Bitte überweise den Betrag bis zum ${germanDate(input.dueOn)} (Zahlungsziel sieben Tage) unter Angabe der Rechnungsnummer auf das in der Rechnung genannte Konto. Hast du bereits bar bezahlt, erhältst du nach Erfassung der Zahlung eine Quittung.`,
    "",
    `Bei Fragen zur Rechnung erreichst du uns unter ${site.phoneDisplay} oder ${site.bookingEmail}.`,
    "",
    "Viele Grüße",
    `${site.owner} · ${site.legalName}`,
  ].join("\n");
}

/** One owner message per topic and detail; repeated runs do not repeat it. */
async function ownerAlert(
  sql: Sql,
  bookingId: number | null,
  topic: string,
  detail: string,
  body: string,
  attachments?: { filename: string; content: string; content_type: string }[],
) {
  const reference = bookingId ? `WG-${bookingId}` : "Rechnungsautomatik";
  const id = await enqueueNotification(sql, {
    key: ownerKey(bookingId ?? 0, topic, detail),
    eventType: RO_OWNER,
    channel: "email",
    to: bookingOwnerNotifyTargets().email,
    bookingId,
    subject: `${reference}: ${topic.replace(/-/g, " ")}`,
    body,
    attachments,
  });
  if (id)
    await sql`insert into automation_events(shop_id, area, event, severity, context)
      values (${SHOP}, 'rechnung', ${topic}, 'warning', ${`${reference}: ${detail.slice(0, 200)}`})`;
}

type EligibleRow = {
  booking_id: number;
  ro_order_id: number;
  ro_contact_id: number | null;
  completed_at: string | Date;
  scheduled_for: string | Date | null;
  amount_cents: number;
  customer_name: string;
  email: string | null;
  class_id: string;
};

async function eligible(sql: Sql, bookingId: number) {
  const [row] = await sql<EligibleRow>`select b.id as booking_id,q.ro_order_id,q.ro_contact_id,
      s.completed_at,s.scheduled_for,s.amount_cents,
      b.customer_name,b.email,b.class_id
    from bookings b join roapp_sync_queue q on q.booking_id=b.id and q.shop_id=b.shop_id
    join roapp_order_state s on s.booking_id=b.id
    where b.shop_id=${SHOP} and b.id=${bookingId} and q.account_scope=${roappAccountScope()}
      and q.ro_order_id is not null and s.fixed_price and s.owner_confirmed_at is not null
      and s.completed_at is not null and s.amount_cents>0
      and b.status not in ('storniert','abgelehnt','nicht_erschienen')`;
  return row;
}

/** Plans an invoice once per completed order. Orders completed before the start
 * may already carry a manual invoice. Local completion time is only an observation,
 * so the proof is the owner's confirmation seen after the start: at that moment RO
 * still showed the open status "Termin verbindlich", hence completion came later. */
async function planInvoices(sql: Sql, config: RoInvoiceConfig) {
  const scope = roappAccountScope();
  const rows = await sql<{ booking_id: number }>`
    insert into roapp_invoices(booking_id,shop_id,account_scope,ro_order_id,completed_at,due_at)
    select s.booking_id,${SHOP},${scope},q.ro_order_id,s.completed_at,
      s.completed_at + (${config.delayMinutes} * interval '1 minute')
    from roapp_order_state s
    join roapp_sync_queue q on q.booking_id=s.booking_id and q.shop_id=${SHOP} and q.account_scope=${scope}
    join bookings b on b.id=s.booking_id and b.shop_id=${SHOP}
    where q.ro_order_id is not null and s.fixed_price and s.owner_confirmed_at is not null
      and s.completed_at is not null and s.owner_confirmed_at>=${config.from}::timestamptz and s.amount_cents>0
      and b.status not in ('storniert','abgelehnt','nicht_erschienen')
    on conflict (booking_id) do update set status='geplant',reason=null,attempts=0,
      completed_at=excluded.completed_at,due_at=excluded.due_at,updated_at=now()
    where roapp_invoices.status='verworfen' and roapp_invoices.invoice_number is null
    returning booking_id`;
  return rows.length;
}

/** Undo planning if RO left the completed state; alert once if an issued invoice no longer matches. */
async function reconcileInvoices(sql: Sql) {
  const scope = roappAccountScope();
  const discarded = await sql<{ booking_id: number }>`
    update roapp_invoices i set status='verworfen',reason='auftrag_nicht_mehr_abgeschlossen',
      lease_token=null,locked_until=null,updated_at=now()
    where i.account_scope=${scope} and i.status in ('geplant','wartet','pruefung') and i.invoice_number is null
      and not exists (select 1 from roapp_order_state s join bookings b on b.id=s.booking_id
        where s.booking_id=i.booking_id and s.completed_at is not null and s.fixed_price
          and s.owner_confirmed_at is not null and b.status not in ('storniert','abgelehnt','nicht_erschienen'))
    returning booking_id`;
  const changed = await sql<{
    booking_id: number;
    invoice_number: string;
    gross_cents: number;
    completed: boolean;
    amount_cents: number | null;
  }>`select i.booking_id,i.invoice_number,i.gross_cents,
      (s.completed_at is not null) as completed,s.amount_cents
    from roapp_invoices i left join roapp_order_state s on s.booking_id=i.booking_id
    where i.account_scope=${scope} and i.status in ('ausgestellt','versendet') and i.attention is null
      and (s.booking_id is null or s.completed_at is null or s.amount_cents<>i.gross_cents)`;
  for (const row of changed) {
    const reason = !row.completed
      ? "auftrag_nach_rechnung_geaendert"
      : "betrag_nach_rechnung_geaendert";
    await sql.transaction(async (tx) => {
      const marked = await tx`update roapp_invoices set attention=${reason},updated_at=now()
        where booking_id=${row.booking_id} and attention is null returning booking_id`;
      if (!marked.length) return;
      await ownerAlert(
        tx,
        row.booking_id,
        "rechnung-pruefen",
        `${row.invoice_number}:${reason}`,
        [
          `Der RO-Auftrag zu WG-${row.booking_id} wurde nach Ausstellung der Rechnung ${row.invoice_number} (${euro(row.gross_cents)}) geändert${row.completed ? ` (neuer Betrag ${euro(row.amount_cents ?? 0)})` : " oder storniert/wieder geöffnet"}.`,
          "Die ausgestellte Rechnung bleibt unverändert gültig und wird nicht automatisch storniert oder neu erstellt.",
          "Bitte prüfen, ob eine Stornorechnung bzw. Korrektur erforderlich ist, und diese manuell erstellen.",
        ].join("\n"),
      );
    });
  }
  return discarded.length;
}

function serviceDates(completedAt: string | Date, scheduledFor: string | Date | null) {
  const to = berlinCalendarDate(new Date(completedAt));
  const scheduled = scheduledFor ? berlinCalendarDate(new Date(scheduledFor)) : to;
  const from =
    scheduled < to &&
    Date.parse(`${to}T12:00:00Z`) - Date.parse(`${scheduled}T12:00:00Z`) <= 30 * DAY
      ? scheduled
      : to;
  return { from, to };
}

async function claimDue(sql: Sql) {
  const token = randomUUID();
  await sql`update roapp_invoices set status='geplant',lease_token=null,locked_until=null,updated_at=now()
    where account_scope=${roappAccountScope()} and status='in_arbeit' and locked_until<now()`;
  const [row] = await sql<{
    booking_id: number;
    ro_order_id: number;
    attempts: number;
    status: string;
  }>`
    update roapp_invoices set status='in_arbeit',lease_token=${token},locked_until=now()+interval '2 minutes',
      attempts=attempts+1,updated_at=now()
    where booking_id=(select booking_id from roapp_invoices where account_scope=${roappAccountScope()}
      and status in ('geplant','wartet') and due_at<=now() order by due_at,booking_id limit 1 for update skip locked)
    returning booking_id,ro_order_id,attempts,status`;
  return row ? { ...row, token } : null;
}

async function release(
  sql: Sql,
  bookingId: number,
  token: string,
  status: "geplant" | "wartet" | "pruefung" | "verworfen",
  reason: string,
  delayMinutes: number,
) {
  await sql`update roapp_invoices set status=${status},reason=${reason},lease_token=null,locked_until=null,
    due_at=now()+(${delayMinutes} * interval '1 minute'),updated_at=now()
    where booking_id=${bookingId} and lease_token=${token}`;
}

async function issue(
  sql: Sql,
  job: { booking_id: number; ro_order_id: number; attempts: number; token: string },
  request: RoappRequest,
  config: RoInvoiceConfig,
): Promise<"issued" | "waiting" | "review" | "discarded" | "retry"> {
  const { refreshRoOrder } = await import("./roapp-callback.ts");
  await refreshRoOrder(sql, job.ro_order_id, request);
  const row = await eligible(sql, job.booking_id);
  if (!row) {
    await release(
      sql,
      job.booking_id,
      job.token,
      "verworfen",
      "auftrag_nicht_mehr_abgeschlossen",
      0,
    );
    return "discarded";
  }
  const lines = await getOrderLines(request, job.ro_order_id);
  const totals = invoiceTotals(lines);
  if (totals.gross !== row.amount_cents)
    throw new RoappError("roapp_items_total_mismatch", { review: true });
  const contact = await currentRoContact(sql, row.booking_id, request);
  const recipient: Recipient = {
    name: contact.name || row.customer_name,
    address: contact.address,
    email: contact.email,
  };
  if (totals.gross > SMALL_INVOICE_LIMIT_CENTS && !recipient.address) {
    await sql.transaction(async (tx) => {
      await release(tx, row.booking_id, job.token, "wartet", "rechnungsadresse_fehlt", 360);
      await ownerAlert(
        tx,
        row.booking_id,
        "rechnungsadresse-fehlt",
        `${row.ro_order_id}`,
        [
          `Für WG-${row.booking_id} (${euro(totals.gross)}) fehlt die vollständige Anschrift des Kunden.`,
          "Rechnungen über 250 € benötigen Name und Anschrift des Leistungsempfängers. Es wurde keine Rechnungsnummer vergeben.",
          contact.source === "ro"
            ? "Bitte die Anschrift im RO-Kontakt ergänzen. Die Website prüft alle sechs Stunden erneut und stellt die Rechnung danach automatisch aus; im Betriebspanel kann die Prüfung sofort ausgelöst werden."
            : "Der RO-Kontakt konnte nicht mit Anschrift gelesen werden. Bitte diese Rechnung manuell erstellen oder die Adressübernahme prüfen lassen.",
        ].join("\n"),
      );
    });
    return "waiting";
  }
  const issuedOn = berlinCalendarDate();
  const dueOn = addDays(issuedOn, 7);
  const service = serviceDates(row.completed_at, row.scheduled_for);
  const vehicle = vehicleClasses.find((item) => item.id === row.class_id)?.label || "";
  const issued = await sql.transaction(async (tx) => {
    const [lease] =
      await tx`select booking_id from roapp_invoices where booking_id=${row.booking_id}
      and lease_token=${job.token} and invoice_number is null for update`;
    if (!lease) return null;
    const year = Number(issuedOn.slice(0, 4));
    const [sequence] = await tx<{ last_value: number }>`
      insert into roapp_invoice_numbers(year,last_value) values(${year},1)
      on conflict (year) do update set last_value=roapp_invoice_numbers.last_value+1
      returning last_value`;
    const number = invoiceNumber(year, sequence.last_value);
    const pdf = await renderRoInvoicePdf({
      number,
      bookingId: row.booking_id,
      issuedOn,
      serviceFrom: service.from,
      serviceTo: service.to,
      dueOn,
      recipient,
      vehicle,
      lines,
      config,
    });
    const delivery = recipient.email ? "email" : "inhaber";
    await tx`update roapp_invoices set status='ausgestellt',reason=null,lease_token=null,locked_until=null,
      invoice_number=${number},issued_on=${issuedOn}::date,service_from=${service.from}::date,
      service_to=${service.to}::date,payment_due_on=${dueOn}::date,gross_cents=${totals.gross},
      net_cents=${totals.net},vat_cents=${totals.vat},recipient_email=${recipient.email},
      recipient=${JSON.stringify(recipient)}::jsonb,lines=${JSON.stringify(lines)}::jsonb,
      pdf_base64=${pdf},delivery=${delivery},updated_at=now()
      where booking_id=${row.booking_id} and lease_token=${job.token}`;
    const attachments = [
      { filename: `Rechnung-${number}.pdf`, content: pdf, content_type: "application/pdf" },
    ];
    if (recipient.email) {
      await enqueueNotification(tx, {
        key: roInvoiceMessageKey(row.booking_id, "invoice", number),
        eventType: RO_INVOICE,
        channel: "email",
        to: recipient.email,
        bookingId: row.booking_id,
        subject: `Rechnung ${number} – White Gloss Detailing`,
        body: invoiceEmailBody({
          name: recipient.name,
          number,
          bookingId: row.booking_id,
          grossCents: totals.gross,
          dueOn,
        }),
        attachments,
      });
    } else {
      await ownerAlert(
        tx,
        row.booking_id,
        "rechnung-ohne-email",
        number,
        [
          `Rechnung ${number} für WG-${row.booking_id} (${euro(totals.gross)}) wurde ausgestellt.`,
          "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt. Die Rechnung liegt als PDF bei und muss persönlich oder per Post übergeben werden.",
          "Eine später im RO-Kontakt ergänzte E-Mail-Adresse führt nicht zu einem automatischen Zweitversand.",
        ].join("\n"),
        attachments,
      );
    }
    return { number, delivery };
  });
  if (!issued) return "retry";
  await commentInvoice(
    sql,
    row.booking_id,
    job.ro_order_id,
    request,
    issued.number,
    totals.gross,
    issued.delivery,
  );
  return "issued";
}

async function commentInvoice(
  sql: Sql,
  bookingId: number,
  orderId: number,
  request: RoappRequest,
  number: string,
  grossCents: number,
  delivery: string | null,
) {
  try {
    await createOrderComment(
      journalRoappWrites(sql, bookingId, request),
      orderId,
      `Rechnung ${number} über ${euro(grossCents)} wurde von der Website erstellt. ${
        delivery === "email"
          ? "Der E-Mail-Versand an den Kunden ist beauftragt; den Versandstatus zeigt das Website-Betriebspanel."
          : "Keine Kunden-E-Mail: Übergabe durch den Inhaber (PDF an buchung@white-gloss.de)."
      } Keine weitere Rechnung in RO anlegen. Zahlungen erst nach tatsächlichem Eingang im Website-Betriebspanel erfassen.`,
    );
    await sql`update roapp_invoices set ro_comment_state='erledigt',updated_at=now() where booking_id=${bookingId}`;
  } catch (error) {
    const review = error instanceof RoappError && error.review;
    await sql.transaction(async (tx) => {
      const changed =
        await tx`update roapp_invoices set ro_comment_state=${review ? "pruefung" : "offen"},updated_at=now()
        where booking_id=${bookingId} and ro_comment_state<>${review ? "pruefung" : "offen"} returning booking_id`;
      if (review && changed.length)
        await ownerAlert(
          tx,
          bookingId,
          "ro-hinweis-fehlt",
          number,
          [
            `Rechnung ${number} für WG-${bookingId} ist ausgestellt, aber der Hinweis im RO-Auftrag konnte nicht sicher gesetzt werden.`,
            "Bitte in RO keine zweite Rechnung anlegen und den Hinweis „Rechnung durch Website erstellt“ manuell als privaten Kommentar ergänzen.",
          ].join("\n"),
        );
    });
  }
}

export async function runRoInvoices(
  sql: Sql,
  options: { request?: RoappRequest; limit?: number } = {},
) {
  const result = { planned: 0, issued: 0, waiting: 0, review: 0, discarded: 0, retried: 0 };
  if (!roInvoiceEnabled()) return result;
  await ensureRoInvoiceSchema(sql);
  const { config, problems } = roInvoiceConfig();
  if (!config) {
    await ownerAlert(
      sql,
      null,
      "rechnungskonfiguration",
      problems.join("|"),
      `Die Rechnungsautomatik ist eingeschaltet, aber unvollständig konfiguriert:\n${problems.join("\n")}\nEs werden keine Rechnungen erstellt.`,
    ).catch(() => undefined);
    return result;
  }
  const creds = options.request ? null : roappCredentialsFromEnv();
  if (!options.request && !creds) return result;
  const request = options.request || createRoappClient(creds!);
  result.discarded += await reconcileInvoices(sql);
  result.planned = await planInvoices(sql, config);
  for (const pending of await sql<{
    booking_id: number;
    ro_order_id: number;
    invoice_number: string;
    gross_cents: number;
    delivery: string | null;
  }>`select booking_id,ro_order_id,invoice_number,gross_cents,delivery from roapp_invoices
    where account_scope=${roappAccountScope()} and status in ('ausgestellt','versendet')
      and ro_comment_state='offen' limit 3`)
    await commentInvoice(
      sql,
      pending.booking_id,
      pending.ro_order_id,
      request,
      pending.invoice_number,
      pending.gross_cents,
      pending.delivery,
    );
  for (let index = 0; index < (options.limit ?? 3); index++) {
    const job = await claimDue(sql);
    if (!job) break;
    try {
      const outcome = await issue(sql, job, request, config);
      if (outcome === "issued") result.issued++;
      else if (outcome === "waiting") result.waiting++;
      else if (outcome === "discarded") result.discarded++;
      else result.retried++;
    } catch (error) {
      const code = error instanceof RoappError ? error.code : "rechnung_fehlgeschlagen";
      const definitive = (error instanceof RoappError && error.review) || job.attempts >= 6;
      if (definitive) {
        await sql.transaction(async (tx) => {
          await release(tx, job.booking_id, job.token, "pruefung", code, 0);
          await ownerAlert(
            tx,
            job.booking_id,
            "rechnung-pruefung",
            code,
            [
              `Die Rechnung zu WG-${job.booking_id} wurde nicht automatisch erstellt (${code}).`,
              "Es wurde keine Rechnungsnummer vergeben und nichts an den Kunden gesendet.",
              "Bitte RO-Auftrag (Positionen, Rabatte, Betrag) prüfen und danach im Betriebspanel „Erneut prüfen“ wählen oder die Rechnung manuell erstellen.",
            ].join("\n"),
          );
        });
        result.review++;
      } else {
        await release(sql, job.booking_id, job.token, "geplant", code, 10);
        result.retried++;
      }
    }
  }
  return result;
}

/** Owner action after checking RO data: retry an invoice that waits or needs review. */
export async function retryRoInvoice(sql: Sql, bookingId: number) {
  if (!(await invoiceTablesExist(sql))) return false;
  const rows =
    await sql`update roapp_invoices set status='geplant',reason=null,attempts=0,due_at=now(),updated_at=now()
    where booking_id=${bookingId} and account_scope=${roappAccountScope()} and status in ('wartet','pruefung')
      and invoice_number is null returning booking_id`;
  return rows.length > 0;
}

export type PaymentInput = {
  invoiceNumber: string;
  amountCents: number;
  method: "bar" | "ueberweisung";
  paidOn: string;
  requestId: string;
  recordedBy: string;
};

/** Records money that has actually been received. Never inferred from RO statuses. */
export async function recordRoInvoicePayment(
  sql: Sql,
  input: PaymentInput,
  today = berlinCalendarDate(),
) {
  if (!(await invoiceTablesExist(sql))) throw new Error("Rechnung nicht gefunden.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0)
    throw new Error("Bitte einen gültigen Betrag eingeben.");
  if (!["bar", "ueberweisung"].includes(input.method)) throw new Error("Zahlungsart ungültig.");
  if (!isCalendarDate(input.paidOn) || input.paidOn > today)
    throw new Error("Das Zahlungsdatum darf nicht in der Zukunft liegen.");
  if (input.paidOn < addDays(today, -400)) throw new Error("Das Zahlungsdatum ist zu alt.");
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId)) throw new Error("Anfrage ungültig.");
  const config = roInvoiceConfig().config;
  return sql.transaction(async (tx) => {
    const [invoice] = await tx<{
      booking_id: number;
      invoice_number: string;
      gross_cents: number;
      paid_cents: number;
      recipient: Recipient;
      recipient_email: string | null;
      status: string;
    }>`select booking_id,invoice_number,gross_cents,paid_cents,recipient,recipient_email,status
      from roapp_invoices where invoice_number=${input.invoiceNumber} and account_scope=${roappAccountScope()}
      for update`;
    if (!invoice || !["ausgestellt", "versendet"].includes(invoice.status))
      throw new Error("Rechnung nicht gefunden.");
    const [duplicate] = await tx<{ id: number }>`select id from roapp_invoice_payments
      where invoice_number=${invoice.invoice_number} and request_id=${input.requestId}::uuid`;
    if (duplicate) return { duplicate: true, paymentStatus: null };
    const open = invoice.gross_cents - invoice.paid_cents;
    if (input.amountCents > open)
      throw new Error(`Der Betrag übersteigt den offenen Rest von ${euro(open)}.`);
    const [payment] = await tx<{ id: number }>`insert into roapp_invoice_payments
      (invoice_number,request_id,amount_cents,method,paid_on,recorded_by)
      values(${invoice.invoice_number},${input.requestId}::uuid,${input.amountCents},${input.method},
        ${input.paidOn}::date,${input.recordedBy}) returning id`;
    const paid = invoice.paid_cents + input.amountCents;
    const paymentStatus = paid >= invoice.gross_cents ? "bezahlt" : "teilbezahlt";
    await tx`update roapp_invoices set paid_cents=${paid},payment_status=${paymentStatus},
      paid_on=case when ${paymentStatus}='bezahlt' then ${input.paidOn}::date else paid_on end,updated_at=now()
      where invoice_number=${invoice.invoice_number}`;
    if (input.method === "bar") {
      const [{ count }] = await tx<{
        count: number;
      }>`select count(*)::int as count from roapp_invoice_payments
        where invoice_number=${invoice.invoice_number} and method='bar'`;
      const receiptNumber = `${invoice.invoice_number}-Q${count}`;
      const pdf = await renderReceiptPdf({
        receiptNumber,
        invoiceNumber: invoice.invoice_number,
        bookingId: invoice.booking_id,
        recipient: invoice.recipient,
        amountCents: input.amountCents,
        paidOn: input.paidOn,
        openCents: invoice.gross_cents - paid,
        config,
      });
      await tx`update roapp_invoice_payments set receipt_number=${receiptNumber},receipt_pdf_base64=${pdf}
        where id=${payment.id}`;
      const attachments = [
        {
          filename: `Quittung-${receiptNumber}.pdf`,
          content: pdf,
          content_type: "application/pdf",
        },
      ];
      if (invoice.recipient_email) {
        await enqueueNotification(tx, {
          key: roInvoiceMessageKey(invoice.booking_id, "receipt", receiptNumber),
          eventType: RO_RECEIPT,
          channel: "email",
          to: invoice.recipient_email,
          bookingId: invoice.booking_id,
          subject: `Quittung ${receiptNumber} – White Gloss Detailing`,
          body: [
            `Hallo ${invoice.recipient.name},`,
            "",
            `wir bestätigen den Erhalt deiner Barzahlung über ${euro(input.amountCents)} am ${germanDate(input.paidOn)} zur Rechnung ${invoice.invoice_number}. Die Quittung findest du im Anhang.`,
            paid >= invoice.gross_cents
              ? "Die Rechnung ist damit vollständig bezahlt."
              : `Offener Restbetrag: ${euro(invoice.gross_cents - paid)}.`,
            "",
            "Viele Grüße",
            `${site.owner} · ${site.legalName}`,
          ].join("\n"),
          attachments,
        });
      } else {
        await ownerAlert(
          tx,
          invoice.booking_id,
          "quittung-ohne-email",
          receiptNumber,
          `Quittung ${receiptNumber} wurde erstellt. Keine Kunden-E-Mail hinterlegt; bitte die beiliegende Quittung persönlich übergeben.`,
          attachments,
        );
      }
    }
    return { duplicate: false, paymentStatus };
  });
}

/** Called by the delivery worker immediately before sending invoice or receipt mail. */
export async function validateRoInvoiceMessage(
  sql: Sql,
  message: {
    booking_id: number | null;
    event_key: string;
    event_type: string | null;
    to_addr: string | null;
  },
) {
  if (!message.booking_id || !approvedRoInvoiceMessage(message.event_key, message.event_type || ""))
    return false;
  const stampValue = message.event_key.split(":")[4];
  if (message.event_type === RO_INVOICE) {
    const [row] = await sql<{ invoice_number: string; recipient_email: string | null }>`
      select invoice_number,recipient_email from roapp_invoices where booking_id=${message.booking_id}
        and account_scope=${roappAccountScope()} and status in ('ausgestellt','versendet') and delivery='email'`;
    return Boolean(
      row && stamp(row.invoice_number) === stampValue && row.recipient_email === message.to_addr,
    );
  }
  const rows = await sql<{ receipt_number: string; recipient_email: string | null }>`
    select p.receipt_number,i.recipient_email from roapp_invoice_payments p
    join roapp_invoices i on i.invoice_number=p.invoice_number
    where i.booking_id=${message.booking_id} and i.account_scope=${roappAccountScope()} and p.receipt_number is not null`;
  return rows.some(
    (row) => stamp(row.receipt_number) === stampValue && row.recipient_email === message.to_addr,
  );
}

export async function markRoInvoiceSent(sql: Sql, bookingId: number) {
  await sql`update roapp_invoices set status='versendet',sent_at=coalesce(sent_at,now()),updated_at=now()
    where booking_id=${bookingId} and status='ausgestellt'`;
}

export async function roInvoiceOverview(sql: Sql) {
  const enabled = roInvoiceEnabled();
  const { problems } = roInvoiceConfig();
  if (!(await invoiceTablesExist(sql))) return { enabled, problems, invoices: [] };
  // Everything that still needs action is always listed; settled history is capped.
  const invoices = await sql<{
    booking_id: number;
    status: string;
    reason: string | null;
    attention: string | null;
    invoice_number: string | null;
    issued_on: string | null;
    payment_due_on: string | null;
    gross_cents: number | null;
    paid_cents: number;
    payment_status: string;
    delivery: string | null;
    sent_at: string | null;
    due_at: string;
    ro_comment_state: string;
  }>`select booking_id,status,reason,attention,invoice_number,issued_on::text,payment_due_on::text,gross_cents,
      paid_cents,payment_status,delivery,sent_at::text,due_at::text,ro_comment_state
    from roapp_invoices where account_scope=${roappAccountScope()} and (
      status in ('geplant','wartet','in_arbeit','pruefung') or attention is not null
      or ro_comment_state='pruefung' or (status in ('ausgestellt','versendet') and payment_status<>'bezahlt')
      or booking_id in (select booking_id from roapp_invoices where account_scope=${roappAccountScope()}
        order by coalesce(issued_on::timestamptz,due_at) desc,booking_id desc limit 100))
    order by coalesce(issued_on::timestamptz,due_at) desc,booking_id desc`;
  return { enabled, problems, invoices };
}

export async function roInvoicePdf(sql: Sql, invoiceNumber: string) {
  if (!(await invoiceTablesExist(sql))) return null;
  const [row] = await sql<{ pdf_base64: string }>`select pdf_base64 from roapp_invoices
    where invoice_number=${invoiceNumber} and account_scope=${roappAccountScope()} and pdf_base64 is not null`;
  return row?.pdf_base64 || null;
}
