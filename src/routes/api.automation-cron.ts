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
          const { runAutomationCatchUp } = await import("@/lib/automation.server");
          const result = await runAutomationCatchUp();
          return Response.json({ ok: true, ...result }, { status: 200 });
        } catch (error) {
          console.error("[automation-cron] Lauf fehlgeschlagen", error);
          return Response.json({ ok: false, error: "Automationslauf fehlgeschlagen." }, { status: 500 });
        }
      },
    },
  },
});
