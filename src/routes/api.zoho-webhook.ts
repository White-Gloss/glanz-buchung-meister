import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/zoho-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { zohoWebhookAuthorized, handleZohoInbound, resolveZohoWebhookSecret } = await import("@/lib/zoho-inbound");
        const url = new URL(request.url);
        const header = request.headers.get("authorization") || request.headers.get("x-zoho-webhook-token");
        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        const secret = await resolveZohoWebhookSecret(sql);
        if (!zohoWebhookAuthorized(header, url.searchParams.get("token"), secret)) {
          return Response.json(
            { ok: false, error: "unauthorized" },
            { status: 401, headers: { "cache-control": "no-store" } },
          );
        }
        const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!payload || typeof payload !== "object") {
          return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        }
        try {
          const actor = (process.env.OWNER_USER_ID || process.env.OWNER_EMAIL || "").trim();
          const result = await handleZohoInbound(sql, payload, actor);
          const { kickBookingDelivery } = await import("@/lib/booking-delivery");
          kickBookingDelivery(sql);
          return Response.json(
            { ok: true, result },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "processing_failed";
          return Response.json(
            { ok: false, error: message },
            { status: 409, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
