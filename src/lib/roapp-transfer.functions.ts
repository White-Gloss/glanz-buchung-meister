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
  releaseRoappTransfer,
  retryRoappTransfer,
  roappTransferOverview,
  setRoappTransferEnabled,
  transferErrorCode,
  transferProblemText,
} from "@/lib/roapp-sync";

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
        reason: row.last_error
          ? transferProblemText[transferErrorCode(row.last_error)] || null
          : null,
        unclearWrite:
          !!row.last_error &&
          transferErrorCode(row.last_error) === "roapp_write_needs_reconciliation",
      })),
      owner: await canConfirmBookings(sql, context.userId),
    };
  });

export const retryRoTransfer = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({ bookingId: z.number().int().positive(), checkedInRo: z.boolean().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!roappOnlyEnabled()) throw new Error("RO App ist nicht das aktive CRM.");
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der Inhaber darf Übertragungen erneut starten.");
    // An unclear write is only released after the owner confirmed it is missing in RO.
    const retried = data.checkedInRo
      ? await releaseRoappTransfer(sql, data.bookingId)
      : await retryRoappTransfer(sql, data.bookingId);
    if (retried) kickBookingDelivery(sql);
    return { retried };
  });

export const setRoTransfer = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!roappOnlyEnabled()) throw new Error("RO App ist nicht das aktive CRM.");
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der Inhaber darf die Übertragung nach RO umschalten.");
    const enabled = await setRoappTransferEnabled(sql, data.enabled);
    if (enabled) kickBookingDelivery(sql);
    return { enabled };
  });
