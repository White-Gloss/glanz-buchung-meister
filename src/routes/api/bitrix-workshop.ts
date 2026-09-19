import { createFileRoute } from "@tanstack/react-router";
import { createBitrixBridgeHandler } from "@/lib/bitrix-workshop-bridge";
import { kickBookingDelivery } from "@/lib/booking-delivery";
import { roappOnlyEnabled } from "@/lib/booking-backend";

const handle = createBitrixBridgeHandler({
  getSql: async () => (await import("@/lib/db")).getSql(),
  kick: (sql) => {
    void kickBookingDelivery(sql);
  },
});
export const Route = createFileRoute("/api/bitrix-workshop")({
  server: {
    handlers: {
      POST: ({ request }) =>
        roappOnlyEnabled() ? new Response(null, { status: 410 }) : handle(request),
    },
  },
});
