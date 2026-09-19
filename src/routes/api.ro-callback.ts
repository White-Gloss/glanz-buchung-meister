import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/ro-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getSql } = await import("@/lib/db");
        const { handleRoCallback } = await import("@/lib/roapp-callback");
        return handleRoCallback(request, await getSql());
      },
    },
  },
});
