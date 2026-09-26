import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { canConfirmBookings } from "@/lib/booking-owner";
import { ensureHubSyncSchema, resolveHubSecret } from "@/lib/hub-sync";
import { hubSecretConfigured, newHubSyncToken } from "@/lib/hub-sync-auth";

const SHOP = "white-gloss";

export const hubSyncStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const resolved = await resolveHubSecret(sql);
    return {
      configured: hubSecretConfigured(resolved.secret),
      source: resolved.source,
    };
  });

export const issueHubSyncToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId))) {
      throw new Error("Nur der angemeldete Inhaber darf den Hub-Token setzen.");
    }
    const fromEnv = process.env.HUB_SYNC_TOKEN?.trim() ?? "";
    if (hubSecretConfigured(fromEnv)) {
      throw new Error("Auf dem Server steht bereits ein Hub-Token in der Umgebungsdatei. Den Panel-Wert würde die Seite ignorieren.");
    }
    const token = newHubSyncToken();
    await ensureHubSyncSchema(sql);
    const updated = await sql`
      update shop_settings set hub_sync_token=${token}, updated_at=now() where shop_id=${SHOP} returning shop_id
    `;
    if (!updated.length) {
      throw new Error("Shop-Einstellungen fehlen. Bitte Seite neu laden oder Support fragen.");
    }
    return { token, source: "panel" as const };
  });
