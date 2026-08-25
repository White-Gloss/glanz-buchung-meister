import { createFileRoute } from "@tanstack/react-router";
import { protokollFehler } from "@/lib/serverLog";

/**
 * Vergleicht ohne verräterische Laufzeit: ein früh abbrechender
 * Zeichenvergleich verrät über die Antwortzeit, wie viele Zeichen des
 * Geheimnisses bereits stimmen.
 */
async function secretsMatch(actual: string, expected: string): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  // Der Hash gleicht die Länge an — timingSafeEqual wirft bei
  // unterschiedlich langen Puffern und würde die Länge sonst preisgeben.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}

async function authorized(request: Request): Promise<boolean> {
  const expected = process.env.REMINDER_CRON_SECRET?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  return secretsMatch(auth, `Bearer ${expected}`);
}

export const Route = createFileRoute("/api/automation-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.REMINDER_CRON_SECRET?.trim()) {
          return Response.json(
            { ok: false, error: "Cron ist nicht konfiguriert." },
            { status: 503 },
          );
        }
        if (!(await authorized(request))) {
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
          protokollFehler("automation-cron", "Reminder-Lauf fehlgeschlagen", error);
          return Response.json(
            { ok: false, error: "Reminder-Lauf fehlgeschlagen." },
            { status: 500 },
          );
        }
      },
    },
  },
});
