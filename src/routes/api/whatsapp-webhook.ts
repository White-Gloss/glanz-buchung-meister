import { createFileRoute } from "@tanstack/react-router";
import { createWhatsAppWebhookHandler } from "@/lib/whatsapp-webhook";

const handleWebhook = createWhatsAppWebhookHandler({
  getSql: async () => (await import("@/lib/db")).getSql(),
  onDeliveryFailed: async (sql, row, code) =>
    (await import("@/lib/notification-worker")).recordNotificationAttention(sql, row, code),
  onError: (code) => console.error(`[whatsapp-webhook] ${code}`),
});

export const Route = createFileRoute("/api/whatsapp-webhook")({
  server: {
    handlers: {
      GET: ({ request }) => handleWebhook(request),
      POST: ({ request }) => handleWebhook(request),
    },
  },
});
