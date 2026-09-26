import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "./db";
import { verifyBookingStatusToken, bookingStatusUrl } from "./booking-status-token";
import { getBookingUploadCookie } from "./booking-upload-cookie.server";
import { verifyUploadCapability } from "./booking-upload-capability";
import { roappOnlyEnabled } from "./booking-backend";
import { setResponseHeader } from "@tanstack/react-start/server";
export const roappOperationsEnabled = createServerFn({ method: "GET" }).handler(() =>
  roappOnlyEnabled(),
);
export const getBookingStatus = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({ id: z.number().int().positive(), token: z.string().max(100).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    if (!roappOnlyEnabled()) return null;
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
    const [state] = await sql<{
      status_name: string;
      amount_cents: number;
      inquiry_cents: number;
      fixed_price: boolean;
      public_url: string | null;
      scheduled_for: string | null;
      updated_at: string;
    }>`select status_name,amount_cents,inquiry_cents,fixed_price,public_url,scheduled_for,updated_at from roapp_order_state where booking_id=${data.id}`;
    const history = await sql<{
      id: number;
      status_name: string;
      amount_cents: number;
      fixed_price: boolean;
      created_at: string;
    }>`select id,status_name,amount_cents,fixed_price,created_at from roapp_order_history where booking_id=${data.id} order by id desc limit 30`;
    return {
      id: booking.id,
      status: state?.status_name || "Anfrage eingegangen – Preise prüfen",
      amount: state?.fixed_price
        ? state.amount_cents
        : (state?.inquiry_cents ?? booking.total_cents),
      fixed: state?.fixed_price || false,
      approvalUrl: state?.fixed_price ? state.public_url : null,
      scheduledFor: state?.scheduled_for || null,
      history,
      statusUrl: bookingStatusUrl(data.id),
    };
  });
