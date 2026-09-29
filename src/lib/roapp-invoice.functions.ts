import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { canConfirmBookings } from "@/lib/booking-owner";
import { kickBookingDelivery } from "@/lib/booking-delivery";
import { roappOnlyEnabled } from "@/lib/booking-backend";
import {
  recordRoInvoicePayment,
  retryRoInvoice,
  roInvoiceOverview,
  roInvoicePdf,
} from "@/lib/roapp-invoice";

function assertRoappActive() {
  if (!roappOnlyEnabled()) throw new Error("Rechnungen werden im aktiven CRM geführt.");
}

export const roInvoices = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    assertRoappActive();
    const sql = await getSql();
    const overview = await roInvoiceOverview(sql);
    return { ...overview, owner: await canConfirmBookings(sql, context.userId) };
  });

export const roInvoiceDocument = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z.object({ invoiceNumber: z.string().regex(/^WG-RE-\d{4}-\d{4,}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    assertRoappActive();
    assertSameSiteRequest();
    const pdf = await roInvoicePdf(await getSql(), data.invoiceNumber);
    if (!pdf) throw new Error("Rechnung nicht gefunden.");
    return { pdf };
  });

export const recordRoPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        invoiceNumber: z.string().regex(/^WG-RE-\d{4}-\d{4,}$/),
        amountCents: z.number().int().positive().max(100_000_000),
        method: z.enum(["bar", "ueberweisung"]),
        paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        requestId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertRoappActive();
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der Inhaber darf Zahlungseingänge erfassen.");
    const result = await recordRoInvoicePayment(sql, { ...data, recordedBy: context.userId });
    kickBookingDelivery(sql);
    return result;
  });

export const retryRoInvoiceCheck = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ bookingId: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    assertRoappActive();
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der Inhaber darf Rechnungen erneut prüfen lassen.");
    const retried = await retryRoInvoice(sql, data.bookingId);
    if (retried) kickBookingDelivery(sql);
    return { retried };
  });
