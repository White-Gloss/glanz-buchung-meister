import { createFileRoute } from "@tanstack/react-router";
import { roappOnlyEnabled } from "@/lib/booking-backend";
export const Route = createFileRoute("/api/ro-callback")({
  server: {
    handlers: {
      GET: () =>
        new Response(null, {
          status: 405,
          headers: { Allow: "POST", "cache-control": "no-store" },
        }),
      POST: async ({ request }) => {
        if (!roappOnlyEnabled()) return new Response(null, { status: 410 });
        const { getSql } = await import("@/lib/db");
        const { handleRoCallback } = await import("@/lib/roapp-callback");
        return handleRoCallback(request, await getSql());
      },
    },
  },
});
