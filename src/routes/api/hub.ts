import { createFileRoute } from "@tanstack/react-router";
import { handleHubRequest } from "@/lib/hub-sync";
import { bitrixOnlyEnabled, roappOnlyEnabled } from "@/lib/booking-backend";

// The note hub writes bookings; RO or Bitrix24 as sole system excludes a second writer.
const hubRetired = () => roappOnlyEnabled() || bitrixOnlyEnabled();

export const Route = createFileRoute("/api/hub")({
  server: {
    handlers: {
      GET: ({ request }) =>
        hubRetired() ? new Response(null, { status: 410 }) : handleHubRequest(request),
      POST: ({ request }) =>
        hubRetired() ? new Response(null, { status: 410 }) : handleHubRequest(request),
    },
  },
});
