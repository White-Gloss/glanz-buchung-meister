import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const expected = process.env.REMINDER_CRON_SECRET?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

export const Route = createFileRoute("/api/automation-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.REMINDER_CRON_SECRET?.trim()) {
          return Response.json({ ok: false, error: "Cron ist nicht konfiguriert." }, { status: 503 });
        }
        if (!authorized(request)) {
          return Response.json({ ok: false, error: "Nicht autorisiert." }, { status: 401 });
        }

        try {
          // Der regelmäßige Cron darf ausschließlich Terminerinnerungen versenden.
          // Rechnungen werden bewusst NICHT automatisch aus einem Zeitplan erzeugt.
          // Die spätere Endrechnung benötigt eine ausdrückliche Admin-Freigabe
          // nach dem Termin und einen vom Admin gesetzten Endpreis.
          const { runDueAppointmentReminders } = await import("@/lib/automation.server");
          const reminders = await runDueAppointmentReminders();
          return Response.json(
            {
              ok: true,
              processed: 0,
              invoicesCreated: 0,
              invoiceMailsSent: 0,
              errors: 0,
              reminders,
            },
            { status: 200 },
          );
        } catch (error) {
          console.error("[automation-cron] Reminder-Lauf fehlgeschlagen", error);
          return Response.json({ ok: false, error: "Reminder-Lauf fehlgeschlagen." }, { status: 500 });
        }
      },
    },
  },
});
