import { createFileRoute } from "@tanstack/react-router";
import { inboundOperatorMessage } from "@/lib/admin.functions";
import { assertPublicPostLimit } from "@/lib/rate-limit";

export const Route = createFileRoute("/api/operator")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertPublicPostLimit("operator-api", 5, 15 * 60 * 1000);
          const body = (await request.json()) as {
            pin?: unknown;
            text?: unknown;
            channel?: unknown;
            useAi?: unknown;
          };
          const result = await inboundOperatorMessage({
            data: {
              pin: String(body.pin ?? ""),
              text: String(body.text ?? ""),
              channel: body.channel === "telegram" ? "telegram" : "whatsapp",
              useAi: Boolean(body.useAi),
            },
          });
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Fehler";
          const status = /zu viele anfragen/i.test(message) ? 429 : 400;
          return Response.json({ ok: false, result: message }, { status });
        }
      },
    },
  },
});
