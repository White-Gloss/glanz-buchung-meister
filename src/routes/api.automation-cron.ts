import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/automation-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthorized, runNotificationWorker, scheduleDueBookingReminders } =
          await import("@/lib/notification-worker");
        if (!cronAuthorized(request.headers.get("authorization"))) {
          return Response.json(
            { ok: false, error: "unauthorized" },
            { status: 401, headers: { "cache-control": "no-store" } },
          );
        }
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          const { cleanupFailedBookingPhotos } = await import("@/lib/booking-photo-storage");
          const photoCleanup = await cleanupFailedBookingPhotos(sql).then(
            () => "ok",
            () => "failed",
          );
          const remindersChecked = await scheduleDueBookingReminders(sql);
          const { runOdooSync } = await import("@/lib/odoo-sync");
          const { runRoappSync } = await import("@/lib/roapp-sync");
          const { runLexwareSync } = await import("@/lib/lexware-sync");
          const { runZohoSync } = await import("@/lib/zoho-sync");
          const [delivery, odoo, roapp, lexware, zoho] = await Promise.all([
            runNotificationWorker(sql),
            runOdooSync(sql),
            runRoappSync(sql),
            runLexwareSync(sql),
            runZohoSync(sql),
          ]);
          const { scheduleLexwareMail } = await import("@/lib/lexware-mail");
          const lexwareMail = await scheduleLexwareMail(sql).catch(() => ({
            error: "lexware_mail_check_failed",
          }));
          return Response.json(
            {
              ok: true,
              remindersChecked,
              ...delivery,
              odoo,
              roapp,
              lexware,
              zoho,
              photoCleanup,
              lexwareMail,
            },
            { headers: { "cache-control": "no-store" } },
          );
        } catch {
          console.error(
            "[notification-worker] Verarbeitung fehlgeschlagen; keine Verbindungsdetails protokolliert.",
          );
          return Response.json(
            { ok: false, error: "processing_failed" },
            { status: 503, headers: { "cache-control": "no-store", "retry-after": "60" } },
          );
        }
      },
    },
  },
});
