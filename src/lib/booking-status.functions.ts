import { panelOnlyEnabled, roappOnlyEnabled } from "./booking-backend";
import { roappCustomerStatus } from "./roapp-customer-status";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "./db";
import { verifyBookingStatusToken, bookingStatusUrl } from "./booking-status-token";
import { getBookingUploadCookie } from "./booking-upload-cookie.server";
import { verifyUploadCapability } from "./booking-upload-capability";
import { setResponseHeader } from "@tanstack/react-start/server";
import { readBitrixWebhook } from "./bitrix-credentials.server";
import { createBitrixClient } from "./bitrix";
import { nativeCustomerStatus } from "./bitrix-customer-status";
export const getBookingStatus = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({ id: z.number().int().positive(), token: z.string().max(100).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const sql = await getSql();
    const [booking] = await sql<{
      id: number;
      total_cents: number;
      upload_token_hash: string | null;
      upload_token_expires_at: string | null;
    }>`
     select id,total_cents,upload_token_hash,upload_token_expires_at from bookings where id=${data.id} and shop_id='white-gloss'`;
    if (
      !booking ||
      !(data.token
        ? verifyBookingStatusToken(data.id, data.token)
        : verifyUploadCapability(
            getBookingUploadCookie(data.id),
            booking.upload_token_hash,
            booking.upload_token_expires_at,
          ))
    )
      return null;
    if (panelOnlyEnabled())
      return {
        id: booking.id,
        status:
          "Anfrage eingegangen. Angebot und Terminbestätigung erhalten Sie über Ihren persönlichen Link per E-Mail.",
        amount: booking.total_cents,
        fixed: false,
        scheduledFor: null,
        publicUrl: null,
        customerStep: null,
        updatedAt: null,
        statusUrl: bookingStatusUrl(data.id),
      };
    if (roappOnlyEnabled())
      return {
        id: booking.id,
        ...(await roappCustomerStatus(sql, data.id, booking.total_cents)),
        statusUrl: bookingStatusUrl(data.id),
      };
    const [state] = await sql<{ bitrix_deal_id: number | null }>`select bitrix_deal_id from bookings
      where id=${data.id} and shop_id='white-gloss'`;
    const current = state?.bitrix_deal_id
      ? await Promise.resolve()
          .then(async () =>
            nativeCustomerStatus(
              createBitrixClient(await readBitrixWebhook(sql)),
              data.id,
              state.bitrix_deal_id!,
            ),
          )
          .catch(() => ({
            status: "Aktueller Auftragsstand vorübergehend nicht verfügbar",
            amount: booking.total_cents,
            fixed: false,
            scheduledFor: null,
          }))
      : {
          status: "Anfrage eingegangen",
          amount: booking.total_cents,
          fixed: false,
          scheduledFor: null,
        };
    return {
      id: booking.id,
      ...current,
      publicUrl: null,
      customerStep: null,
      updatedAt: null,
      statusUrl: bookingStatusUrl(data.id),
    };
  });
