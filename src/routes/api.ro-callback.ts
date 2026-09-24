import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/ro-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // After the Bitrix24 cutover RO must no longer change bookings.
        const { bitrixOnlyEnabled } = await import("@/lib/booking-backend");
        if (bitrixOnlyEnabled()) return new Response(null, { status: 410 });
        const { getSql } = await import("@/lib/db");
        const { handleRoCallback } = await import("@/lib/roapp-callback");
        return handleRoCallback(request, await getSql());
      },
    },
  },
});
