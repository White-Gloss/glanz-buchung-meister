import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { canConfirmBookings } from "@/lib/booking-owner";
import { kickBookingDelivery } from "@/lib/booking-delivery";
import { roappOnlyEnabled } from "@/lib/booking-backend";
import { retryRoappTransfer, roappTransferOverview, transferProblemText } from "@/lib/roapp-sync";

export const roTransfers = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    if (!roappOnlyEnabled()) throw new Error("RO App ist nicht das aktive CRM.");
    const sql = await getSql();
    const overview = await roappTransferOverview(sql);
    return {
      ...overview,
      rows: overview.rows.map((row) => ({
        ...row,
        reason: row.last_error ? transferProblemText[row.last_error] || null : null,
      })),
      owner: await canConfirmBookings(sql, context.userId),
    };
  });

export const retryRoTransfer = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ bookingId: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!roappOnlyEnabled()) throw new Error("RO App ist nicht das aktive CRM.");
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der Inhaber darf Übertragungen erneut starten.");
    const retried = await retryRoappTransfer(sql, data.bookingId);
    if (retried) kickBookingDelivery(sql);
    return { retried };
  });
