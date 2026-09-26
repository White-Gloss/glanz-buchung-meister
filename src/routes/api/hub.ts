import { createFileRoute } from "@tanstack/react-router";
import { handleHubRequest } from "@/lib/hub-sync";
import { roappOnlyEnabled } from "@/lib/booking-backend";

export const Route = createFileRoute("/api/hub")({
  server: {
    handlers: {
      GET: ({ request }) =>
        roappOnlyEnabled() ? new Response(null, { status: 410 }) : handleHubRequest(request),
      POST: ({ request }) =>
        roappOnlyEnabled() ? new Response(null, { status: 410 }) : handleHubRequest(request),
    },
  },
});
