import { ensureBitrixWorkshopSchema } from "./bitrix-workshop-schema.ts";
import { createHash, verify } from "node:crypto";
import { z } from "zod";
import type { Sql } from "./db.ts";
import { BITRIX_BRIDGE_PUBLIC_KEY } from "./bitrix-bridge-key.ts";
import { isBookingOwner } from "./booking-owner.ts";
import { site } from "../data/site.ts";
import {
  completeServiceWithPayment,
  confirmBookingWithSchedule,
  rejectOrCancelBooking,
  type ZohoBooking,
} from "./zoho-ops.ts";
import { utcToBerlinWall } from "./zoho-time.ts";
import { enqueueNotification, recipientHash } from "./booking-notifications.ts";
import { createBookingConfirmationPdf, confirmationEmailCopy } from "./zoho-documents.ts";
import { isEmailAddress } from "./utils.ts";
import { externalBitrixBusyWindows } from "./bitrix-workshop-calendar.ts";

const rowSchema = z
  .object({
    productName: z.string().min(1).max(300),
    price: z.number().finite().nonnegative(),
    quantity: z.number().positive().max(10000),
    taxRate: z.number().min(0).max(100).optional(),
    taxIncluded: z.union([z.boolean(), z.enum(["Y", "N"])]).optional(),
  })
  .passthrough();
const schema = z.object({
  requestId: z.string().min(8).max(160),
  userId: z.literal(1),
  action: z.enum(["status", "confirmation", "confirm", "cancel", "complete", "invoice", "payment"]),
  dealId: z.number().int().positive(),
  version: z.number().int().positive().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  amountCents: z.number().int().positive().optional(),
  rows: z.array(rowSchema).min(1).max(50).optional(),
  customerAccepted: z.boolean().optional(),
  note: z.string().max(2000).optional(),
  payment: z.enum(["bar", "ueberweisung"]).optional(),
  receivedCents: z.number().int().positive().optional(),
  receivedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  invoiceId: z.number().int().positive().optional(),
  invoiceNumber: z.string().min(1).max(80).optional(),
  pdf: z.string().max(8_000_000).optional(),
  paid: z.boolean().optional(),
});
type Input = z.infer<typeof schema>;
type Booking = ZohoBooking & {
  bitrix_invoice_id: number | null;
  bitrix_deal_id: number | null;
  bitrix_final_rows: z.infer<typeof rowSchema>[] | null;
};

export function verifyBridgeSignature(
  body: string,
  timestamp: string | null,
  signature: string | null,
  publicKey = BITRIX_BRIDGE_PUBLIC_KEY,
  now = Date.now(),
) {
  if (
    !timestamp ||
    !signature ||
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 120_000
  )
    return false;
  try {
    return verify(
      null,
      Buffer.from(`${timestamp}\n${body}`),
      publicKey,
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}

function checkRows(data: Input) {
  if (!data.amountCents || !data.rows?.length)
    throw new Error("Bitte endgültigen Betrag und Leistungen prüfen.");
  const gross = data.rows.reduce(
    (sum, row) =>
      sum +
      Math.round(
        row.price *
          row.quantity *
          (row.taxIncluded === false || row.taxIncluded === "N"
            ? 1 + (row.taxRate ?? 0) / 100
            : 1) *
          100,
      ),
    0,
  );
  if (Math.abs(gross - data.amountCents) > 1)
    throw new Error("Positionen und Endbetrag stimmen nicht überein.");
}

async function ownerId(sql: Sql) {
  const users = await sql<{ id: string; email: string | null; emailVerified: boolean }>`
    select id,email,"emailVerified" from "user"
    where id=${process.env.OWNER_USER_ID?.trim() || ""} or lower(email)=${(process.env.OWNER_EMAIL?.trim() || site.email).toLowerCase()}
  `;
  const owners = users.filter((user) => isBookingOwner(user));
  if (owners.length !== 1)
    throw new Error("Der Website-Inhaber konnte nicht eindeutig zugeordnet werden.");
  return owners[0].id;
}

function result(booking: Booking) {
  return {
    bookingId: booking.id,
    version: booking.version,
    status: booking.status,
    preferredDate: booking.preferred_date,
    preferredSlot: booking.preferred_slot,
    customerEmail: booking.email,
    stage: booking.ops_stage,
    from: booking.work_start_at ? new Date(booking.work_start_at).toISOString() : null,
    to: booking.work_end_at ? new Date(booking.work_end_at).toISOString() : null,
    amountCents: booking.agreed_price_cents ?? booking.total_cents,
    invoiceId: booking.bitrix_invoice_id,
    invoiceStatus: booking.invoice_status,
    paymentStatus: booking.payment_status,
    managed: Boolean(booking.bitrix_workshop_managed),
  };
}

export async function applyBridgeAction(sql: Sql, data: Input) {
  await ensureBitrixWorkshopSchema(sql);
  const actor = await ownerId(sql);
  return sql.transaction(async (tx) => {
    await tx`update booking_workflow_locks set revision=revision+1 where shop_id='white-gloss'`;
    const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
    const [previous] = await tx<{
      body_hash: string;
      response: Record<string, unknown>;
    }>`select body_hash,response from bitrix_bridge_requests where shop_id='white-gloss' and request_id=${data.requestId}`;
    if (previous) {
      if (previous.body_hash !== hash)
        throw new Error(
          "Dieser Vorgang wurde bereits mit anderen Angaben verarbeitet. Bitte neu laden.",
        );
      return previous.response;
    }
    const found = await tx<Booking>`select b.* from bookings b where b.shop_id='white-gloss' and (
      b.bitrix_deal_id=${data.dealId} or exists (select 1 from bitrix_sync_queue q where q.booking_id=b.id and q.shop_id=b.shop_id and q.bitrix_deal_id=${data.dealId})
    ) for update`;
    if (found.length !== 1)
      throw new Error("Diesem Bitrix-Auftrag ist keine eindeutige Website-Anfrage zugeordnet.");
    let booking = found[0];
    if (data.action === "status") {
      const [delivery] = await tx<{
        status: string;
      }>`select status from outbound_queue where shop_id='white-gloss' and booking_id=${booking.id} and event_type='bitrix.invoice' order by id desc limit 1`;
      return {
        ...result(booking),
        invoiceStatus: delivery
          ? {
              sent: "versendet",
              queued: "Versand ausstehend",
              processing: "wird versendet",
              blocked: "Versand blockiert",
              review: "Versand prüfen",
              failed: "Versand fehlgeschlagen",
            }[delivery.status] || delivery.status
          : booking.invoice_status,
      };
    }
    if (data.action === "cancel" && ["storniert", "abgelehnt"].includes(booking.status))
      return result(booking);
    const positions = (rows: typeof booking.bitrix_final_rows) =>
      JSON.stringify(
        (rows || []).map((row) => [
          row.productName,
          Number(row.price),
          Number(row.quantity),
          Number(row.taxRate || 0),
          row.taxIncluded === false || row.taxIncluded === "N",
        ]),
      );
    if (
      data.action === "confirm" &&
      booking.status === "bestaetigt" &&
      data.from &&
      data.to &&
      new Date(booking.work_start_at!).getTime() === new Date(data.from).getTime() &&
      new Date(booking.work_end_at!).getTime() === new Date(data.to).getTime() &&
      booking.agreed_price_cents === data.amountCents &&
      positions(booking.bitrix_final_rows) === positions(data.rows || [])
    )
      return result(booking);
    if (data.action === "confirmation") {
      const [mail] = await tx<{
        attachments: { content: string }[];
      }>`select attachments from outbound_queue where shop_id='white-gloss' and booking_id=${booking.id} and booking_version<=${booking.version} and event_type='booking.confirmed' and event_key like 'bitrix:confirmation:%' order by id desc limit 1`;
      if (!mail?.attachments?.[0]?.content || !["bestaetigt", "erledigt"].includes(booking.status))
        throw new Error("Keine aktuelle Buchungsbestätigung vorhanden.");
      return { ...result(booking), pdf: mail.attachments[0].content };
    }
    if (data.version !== booking.version)
      throw new Error("Der Auftrag wurde inzwischen geändert. Bitte neu laden.");
    if (["confirm", "complete"].includes(data.action)) checkRows(data);
    // Rejecting or cancelling sends no document, so phone-only photo inquiries can be closed.
    if (data.action !== "cancel" && !isEmailAddress(booking.email))
      throw new Error(
        "Für diesen Vorgang ist keine Kunden-E-Mail gespeichert. Anfrage ablehnen und den Kunden um eine Buchung über das Website-Formular bitten.",
      );
    await tx`update bookings set bitrix_workshop_managed=true,bitrix_deal_id=${data.dealId} where id=${booking.id} and shop_id='white-gloss'`;
    if (data.rows)
      await tx`update bookings set bitrix_final_rows=${JSON.stringify(data.rows)}::jsonb where id=${booking.id} and shop_id='white-gloss'`;
    if (data.action === "confirm") {
      if (!data.from || !data.to || new Date(data.to) <= new Date(data.from))
        throw new Error("Bitte Beginn und Ende des Werkstatttermins festlegen.");
      const start = utcToBerlinWall(new Date(data.from)),
        end = utcToBerlinWall(new Date(data.to));
      const external = await externalBitrixBusyWindows(tx, data.from, data.to, data.dealId);
      if (external.length)
        throw new Error("Terminkonflikt: Im Bitrix-Kalender ist dieser Zeitraum bereits belegt.");
      // A reschedule releases and reserves within this same transaction. On conflict everything rolls back.
      if (booking.status === "bestaetigt") {
        if (!data.customerAccepted)
          throw new Error("Bitte die Zustimmung des Kunden zur Umbuchung bestätigen.");
        await tx`update bookings set status='neu',ops_stage='in_pruefung' where id=${booking.id} and shop_id='white-gloss'`;
      }
      const confirmation = await confirmBookingWithSchedule(
        tx,
        booking.id,
        booking.version,
        actor,
        {
          startDate: start.date,
          startTime: start.time,
          endDate: end.date,
          endTime: end.time,
          agreedCents: data.amountCents!,
          customerAccepted: data.customerAccepted,
          internalNotes: data.note,
        },
      );
      booking = confirmation.booking as Booking;
      if (!confirmation.awaitingCustomer) {
        const documentVersion = (booking.confirmation_pdf_version || 0) + 1;
        const pdf = await createBookingConfirmationPdf({
          ...booking,
          confirmation_pdf_version: documentVersion,
          final_rows: data.rows!.map((row) => ({
            name: row.productName,
            quantity: row.quantity,
            grossCents: Math.round(
              row.price *
                row.quantity *
                (row.taxIncluded === false || row.taxIncluded === "N"
                  ? 1 + (row.taxRate ?? 0) / 100
                  : 1) *
                100,
            ),
          })),
        });
        const price = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
          data.amountCents! / 100,
        );
        await enqueueNotification(tx, {
          key: `bitrix:confirmation:${booking.id}:${booking.version}:${recipientHash(booking.email || "")}`,
          eventType: "booking.confirmed",
          channel: "email",
          to: booking.email || "",
          bookingId: booking.id,
          bookingVersion: booking.version,
          subject: `Buchungsbestätigung · White Gloss WG-${booking.id}`,
          body: confirmationEmailCopy(
            booking.customer_name,
            `WG-${booking.id}`,
            `${start.date} ${start.time} bis ${end.date} ${end.time}`,
            price,
          ),
          attachments: [
            {
              filename: `Buchungsbestaetigung-WG-${booking.id}-v${documentVersion}.pdf`,
              content: pdf,
              content_type: "application/pdf",
            },
          ],
        });
        await tx`update bookings set confirmation_pdf_version=${documentVersion} where id=${booking.id} and shop_id='white-gloss'`;
      }
    } else if (data.action === "cancel") {
      if (["erledigt", "nicht_erschienen"].includes(booking.status))
        throw new Error("Abgeschlossene Aufträge können hier nicht storniert werden.");
      booking = (
        await rejectOrCancelBooking(
          tx,
          booking.id,
          booking.version,
          actor,
          booking.status === "bestaetigt" ? "storniert" : "abgelehnt",
        )
      ).booking as Booking;
    } else if (data.action === "complete") {
      if (!data.payment) throw new Error("Bitte Zahlungsart wählen.");
      booking = (
        await completeServiceWithPayment(tx, booking.id, booking.version, actor, {
          payment: data.payment,
          agreedCents: data.amountCents,
          cashCents: data.receivedCents,
          cashDate: data.receivedOn,
        })
      ).booking as Booking;
    } else if (data.action === "payment") {
      if (
        !data.invoiceId ||
        booking.bitrix_invoice_id !== data.invoiceId ||
        booking.status !== "erledigt"
      )
        throw new Error("Rechnung und Auftrag passen nicht zusammen.");
      await tx`update bookings set payment_status='bezahlt',payment_recorded_cents=total_cents,payment_recorded_on=current_date where id=${booking.id} and shop_id='white-gloss'`;
    } else if (data.action === "invoice") {
      if (booking.status !== "erledigt" || !data.invoiceId || !data.invoiceNumber || !data.pdf)
        throw new Error("Abgeschlossener Auftrag und Rechnungs-PDF erforderlich.");
      if (booking.bitrix_invoice_id && booking.bitrix_invoice_id !== data.invoiceId)
        throw new Error("Diesem Auftrag ist bereits eine andere Rechnung zugeordnet.");
      if (!Buffer.from(data.pdf, "base64").subarray(0, 5).equals(Buffer.from("%PDF-")))
        throw new Error("Ungültiges Rechnungs-PDF.");
      const paid = Boolean(data.paid);
      await tx`update bookings set bitrix_invoice_id=${data.invoiceId},invoice_status='versand_ausstehend',payment_status=${paid ? "bezahlt" : "offen"} where id=${booking.id} and shop_id='white-gloss'`;
      await enqueueNotification(tx, {
        key: `bitrix:invoice:${data.invoiceId}:${recipientHash(booking.email || "")}`,
        eventType: "bitrix.invoice",
        channel: "email",
        to: booking.email || "",
        bookingId: booking.id,
        bookingVersion: booking.version,
        subject: `Rechnung ${data.invoiceNumber} · White Gloss`,
        body: `Guten Tag ${booking.customer_name},\n\nanbei erhalten Sie die Rechnung zu WG-${booking.id}. ${paid ? "Der Rechnungsbetrag wurde vollständig bezahlt. Vielen Dank." : "Bitte beachten Sie die Bankverbindung und das Fälligkeitsdatum in der Rechnung."}\n\nWhite Gloss Detailing`,
        attachments: [
          {
            filename: `Rechnung-${data.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
            content: data.pdf,
            content_type: "application/pdf",
          },
        ],
      });
    }
    const [fresh] =
      await tx<Booking>`select * from bookings where id=${booking.id} and shop_id='white-gloss'`;
    const response = result(fresh);
    await tx`insert into bitrix_bridge_requests(shop_id,request_id,body_hash,response) values('white-gloss',${data.requestId},${hash},${JSON.stringify(response)}::jsonb)`;
    return response;
  });
}

export function createBitrixBridgeHandler(deps: {
  getSql: () => Promise<Sql>;
  kick: (sql: Sql) => void;
  publicKey?: string;
}) {
  return async (request: Request) => {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    if (Number(request.headers.get("content-length")) > 9_000_000)
      return new Response(null, { status: 413 });
    const body = await request.text();
    if (body.length > 9_000_000) return new Response(null, { status: 413 });
    if (
      !verifyBridgeSignature(
        body,
        request.headers.get("x-wg-timestamp"),
        request.headers.get("x-wg-signature"),
        deps.publicKey,
      )
    )
      return Response.json({ error: "Nicht autorisiert." }, { status: 401 });
    try {
      const data = schema.parse(JSON.parse(body));
      const sql = await deps.getSql();
      const response = await applyBridgeAction(sql, data);
      if (!["status", "confirmation"].includes(data.action)) deps.kick(sql);
      return Response.json({ data: response }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof z.ZodError
              ? "Ungültige Auftragsdaten."
              : error instanceof Error
                ? error.message
                : "Vorgang fehlgeschlagen.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
