import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { canConfirmBookings } from "@/lib/booking-owner";
import { ensureLexwareSchema } from "@/lib/lexware-sync";
import { mailConfigured } from "@/lib/resend-mail";
import { queueLexwareMail } from "@/lib/lexware-mail";

export const customerMailOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    await ensureLexwareSchema(sql);
    const [setting] = await sql<{
      lexware_mail_enabled: boolean;
    }>`select lexware_mail_enabled from shop_settings where shop_id='white-gloss'`;
    const rows = await sql<{
      id: number;
      booking_id: number | null;
      subject: string;
      to_addr: string;
      status: string;
      delivery_status: string;
      last_error_code: string | null;
      created_at: string;
    }>`select id,booking_id,subject,to_addr,status,delivery_status,last_error_code,created_at from outbound_queue where shop_id='white-gloss' and channel='email' and (event_key like '%:customer-v2:email:%' or event_type in ('lexware.invoice','lexware.reminder')) order by id desc limit 100`;
    return {
      configured: mailConfigured(),
      automatic: Boolean(setting?.lexware_mail_enabled),
      rows,
    };
  });

export const setAutomaticCustomerMail = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z.object({ enabled: z.boolean(), approved: z.literal(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await ensureLexwareSchema(sql);
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der Inhaber darf den automatischen Versand freigeben.");
    if (data.enabled && !mailConfigured())
      throw new Error("Resend und Absender sind noch nicht konfiguriert.");
    await sql.transaction(async (tx) => {
      await tx`update shop_settings set lexware_mail_enabled=${data.enabled},updated_at=now() where shop_id='white-gloss'`;
      await tx`insert into automation_events(shop_id,area,event,severity,context) values('white-gloss','benachrichtigung','kundenmail-automatik','info',${JSON.stringify({ actor: context.userId, enabled: data.enabled })})`;
    });
    return { enabled: data.enabled };
  });

export const sendLexwareCustomerMail = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        bookingId: z.number().int().positive(),
        kind: z.enum(["invoice", "reminder"]),
        approved: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await ensureLexwareSchema(sql);
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der Inhaber darf den Versand auslösen.");
    const result = await queueLexwareMail(sql, data.bookingId, data.kind);
    const { runNotificationWorker } = await import("@/lib/notification-worker");
    await runNotificationWorker(sql, { limit: 5 });
    return result;
  });
