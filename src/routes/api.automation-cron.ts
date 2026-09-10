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
          const remindersChecked = await scheduleDueBookingReminders(sql);
          const { runOdooSync } = await import("@/lib/odoo-sync");
          const { runRoappSync } = await import("@/lib/roapp-sync");
          const { runLexwareSync } = await import("@/lib/lexware-sync");
          const [delivery, odoo, roapp, lexware] = await Promise.all([
            runNotificationWorker(sql),
            runOdooSync(sql),
            runRoappSync(sql),
            runLexwareSync(sql),
          ]);
          return Response.json(
            { ok: true, remindersChecked, ...delivery, odoo, roapp, lexware },
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
