import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { kickBookingDelivery } from "@/lib/booking-delivery";
import { assertPublicPostLimit } from "@/lib/rate-limit";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { queueWithdrawal, withdrawalSchema } from "@/lib/withdrawal";

/** „Widerruf bestätigen“: speichert den Widerruf und stößt die Eingangsbestätigung an. */
export const submitWithdrawal = createServerFn({ method: "POST" })
  .validator((input: unknown) => withdrawalSchema.parse(input))
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    assertPublicPostLimit("withdrawal", 6);
    if (data.website && data.website.trim().length > 0) {
      throw new Error("Anfrage abgelehnt.");
    }
    const sql = await getSql();
    const receipt = await queueWithdrawal(sql, data);
    // Provider failures never roll back the stored declaration; the timer retries.
    kickBookingDelivery(sql);
    return receipt;
  });
