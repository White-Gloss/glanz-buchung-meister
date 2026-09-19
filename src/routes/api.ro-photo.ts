import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ro-photo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getSql } = await import("@/lib/db");
        const { serveRoappPhoto } = await import("@/lib/roapp-photo-links");
        return serveRoappPhoto(request, await getSql());
      },
    },
  },
});
