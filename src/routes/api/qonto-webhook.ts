import { createFileRoute } from "@tanstack/react-router";
import { createQontoWebhookHandler } from "@/lib/qonto-webhook";

const handleWebhook = createQontoWebhookHandler({
  getSql: async () => (await import("@/lib/db")).getSql(),
  onError: (code) => console.error(`[qonto-webhook] ${code}`),
});

export const Route = createFileRoute("/api/qonto-webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleWebhook(request),
    },
  },
});
