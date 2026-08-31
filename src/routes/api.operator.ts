import { createFileRoute } from "@tanstack/react-router";
import { inboundOperatorMessage } from "@/lib/admin.functions";

export const Route = createFileRoute("/api/operator")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
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
          return Response.json(
            { ok: false, result: err instanceof Error ? err.message : "Fehler" },
            { status: 400 },
          );
        }
      },
    },
  },
});
