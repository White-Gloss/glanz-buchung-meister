import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { canConfirmBookings } from "@/lib/booking-owner";
import {
  createLexwareClient,
  lexwareCredentialsFromEnv,
  probeLexware,
  LEXWARE_DEFAULT_API_BASE,
} from "@/lib/lexware";
import { readLexwareCredentials } from "@/lib/lexware-credentials.server";
import { ensureLexwareSchema } from "@/lib/lexware-sync";
import { isCalendarDate } from "@/lib/calendar-date";

const SHOP = "white-gloss";

export const lexwareStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    await ensureLexwareSchema(sql);
    const [setting] = await sql<{
      lexware_sync_enabled: boolean;
      lexware_auto_finalize: boolean;
    }>`select lexware_sync_enabled,lexware_auto_finalize from shop_settings where shop_id=${SHOP}`;
    const fromEnv = Boolean(lexwareCredentialsFromEnv());
    const creds = await readLexwareCredentials(sql);
    return {
      configured: Boolean(creds),
      enabled: Boolean(setting?.lexware_sync_enabled),
      autoFinalize: Boolean(setting?.lexware_auto_finalize),
      source: fromEnv ? ("env" as const) : creds ? ("panel" as const) : ("none" as const),
      apiBase: creds?.apiBase ?? null,
    };
  });

export const lexwareSyncOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureLexwareSchema(sql);
    const rows = await sql<{
      booking_id: number;
      requested_version: number;
      synced_version: number;
      status: string;
      last_error: string | null;
      lex_contact_id: string | null;
      lex_invoice_id: string | null;
      updated_at: string;
      customer_name: string;
      total_cents: number;
      booking_status: string;
      invoice_status: string | null;
      invoice_number: string | null;
      invoice_checked_at: string | null;
      write_pending: string | null;
      billing_data: {
        street: string;
        zip: string;
        city: string;
        countryCode: string;
        serviceDate: string;
        totalCents: number;
        bookingVersion: number;
      } | null;
    }>`
      select q.booking_id,q.requested_version,q.synced_version,q.status,q.last_error,
        q.lex_contact_id,q.lex_invoice_id,q.updated_at,q.invoice_status,q.invoice_number,q.invoice_checked_at,q.write_pending,q.billing_data,
        b.customer_name,b.total_cents,b.status as booking_status
      from lexware_sync_queue q join bookings b on b.id=q.booking_id and b.shop_id=q.shop_id
      where q.shop_id=${SHOP} order by q.booking_id desc limit 100`;
    return { rows, canManage: await canConfirmBookings(sql, context.userId) };
  });

export const saveLexwareApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z.object({ apiKey: z.string().trim().min(20).max(512) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf den Lexware-Schlüssel speichern.");
    const probe = await probeLexware({
      apiKey: data.apiKey,
      apiBase: LEXWARE_DEFAULT_API_BASE,
    });
    if (!probe.ok) return { ok: false, connected: false, error: probe.error };
    await ensureLexwareSchema(sql);
    await sql`update shop_settings set lexware_api_key=${data.apiKey},updated_at=now() where shop_id=${SHOP}`;
    return { ok: true, connected: true, error: null as string | null };
  });

export const setLexwareSyncEnabled = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await ensureLexwareSchema(sql);
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf die Lexware-Übertragung umstellen.");
    if (data.enabled && !(await readLexwareCredentials(sql)))
      throw new Error("Bitte zuerst den Lexware-API-Schlüssel unter Dokumente speichern.");
    await sql`update shop_settings set lexware_sync_enabled=${data.enabled},updated_at=now() where shop_id=${SHOP}`;
    return { enabled: data.enabled };
  });

export const retryLexwareSync = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ bookingId: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await ensureLexwareSchema(sql);
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf eine erneute Lexware-Prüfung starten.");
    await sql`update lexware_sync_queue set status='pending',attempts=0,next_attempt_at=now(),updated_at=now()
      where shop_id=${SHOP} and booking_id=${data.bookingId} and status in ('failed','review') and write_pending is null`;
    return { ok: true };
  });

export const setLexwareAutomaticInvoices = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z.object({ enabled: z.boolean(), understood: z.literal(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await ensureLexwareSchema(sql);
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der Inhaber darf verbindliche Rechnungen freigeben.");
    if (data.enabled && !(await readLexwareCredentials(sql)))
      throw new Error("Bitte zuerst Lexware verbinden.");
    await sql.transaction(async (tx) => {
      await tx`update shop_settings set lexware_auto_finalize=${data.enabled},updated_at=now() where shop_id=${SHOP}`;
      await tx`insert into automation_events(shop_id,area,event,severity,context) values(${SHOP},'lexware','rechnungsautomatik','info',${JSON.stringify({ enabled: data.enabled, actor: context.userId })})`;
    });
    return { enabled: data.enabled };
  });

export const saveLexwareBillingData = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        bookingId: z.number().int().positive(),
        street: z.string().trim().min(3).max(150),
        zip: z.string().trim().min(3).max(16),
        city: z.string().trim().min(2).max(100),
        countryCode: z.string().regex(/^[A-Z]{2}$/),
        serviceDate: z.string().refine(isCalendarDate),
        totalCents: z.number().int().positive(),
        approved: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await ensureLexwareSchema(sql);
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der Inhaber darf Rechnungsdaten freigeben.");
    await sql.transaction(async (tx) => {
      const [booking] = await tx<{
        version: number;
        total_cents: number;
        status: string;
      }>`select version,total_cents,status from bookings where id=${data.bookingId} and shop_id=${SHOP} for update`;
      if (!booking || booking.total_cents !== data.totalCents)
        throw new Error("Der Betrag wurde geändert. Bitte Buchung neu laden und Endpreis prüfen.");
      const { bookingId, approved: _approved, ...fields } = data;
      const rows =
        await tx`update lexware_sync_queue set billing_data=${JSON.stringify({ ...fields, bookingVersion: booking.version, bookingStatus: booking.status })}::jsonb,status='pending',next_attempt_at=now(),last_error=null,updated_at=now()
        where shop_id=${SHOP} and booking_id=${bookingId} and lex_invoice_id is null and write_pending is null returning booking_id`;
      if (!rows.length)
        throw new Error("Bereits übertragene oder unklare Belege zuerst in Lexware prüfen.");
      await tx`insert into automation_events(shop_id,area,event,severity,context) values(${SHOP},'lexware','rechnungsdaten-freigegeben','info',${JSON.stringify({ bookingId, actor: context.userId, version: booking.version, totalCents: data.totalCents })})`;
    });
    return { ok: true };
  });

/** Read the actual voucher; never infer invoice status from queue success. */
export const refreshLexwareInvoice = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ bookingId: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await ensureLexwareSchema(sql);
    const [row] = await sql<{
      lex_invoice_id: string | null;
    }>`select lex_invoice_id from lexware_sync_queue where shop_id=${SHOP} and booking_id=${data.bookingId}`;
    if (!row?.lex_invoice_id) throw new Error("Noch keine zugeordnete Lexware-Rechnung.");
    const creds = await readLexwareCredentials(sql);
    if (!creds) throw new Error("Lexware ist nicht verbunden.");
    const request = createLexwareClient(creds);
    const invoice = await request<{ id: string; voucherStatus: string; voucherNumber?: string }>(
      "GET",
      `/invoices/${encodeURIComponent(row.lex_invoice_id)}`,
    );
    if (invoice.id !== row.lex_invoice_id || typeof invoice.voucherStatus !== "string")
      throw new Error("Lexware lieferte keinen eindeutigen Rechnungsstatus.");
    await sql`update lexware_sync_queue set invoice_status=${invoice.voucherStatus},invoice_number=${invoice.voucherNumber || null},invoice_checked_at=now() where shop_id=${SHOP} and booking_id=${data.bookingId}`;
    return { status: invoice.voucherStatus, number: invoice.voucherNumber || null };
  });
