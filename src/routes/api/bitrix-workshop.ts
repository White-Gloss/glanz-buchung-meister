import { createFileRoute } from "@tanstack/react-router";
import { createBitrixBridgeHandler } from "@/lib/bitrix-workshop-bridge";
import { kickBookingDelivery } from "@/lib/booking-delivery";

const handle = createBitrixBridgeHandler({
  getSql: async () => (await import("@/lib/db")).getSql(),
  kick: (sql) => {
    void kickBookingDelivery(sql);
  },
});
export const Route = createFileRoute("/api/bitrix-workshop")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
