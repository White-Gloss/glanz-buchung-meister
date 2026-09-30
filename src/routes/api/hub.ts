import { createFileRoute } from "@tanstack/react-router";
import { handleHubInquiries, hubMethodNotAllowed } from "@/lib/hub-inquiries";

// Server-to-server pull for the Hub. Read-only; no CORS, no browser use.
export const Route = createFileRoute("/api/hub")({
  server: {
    handlers: {
      POST: ({ request }) => handleHubInquiries(request),
      ANY: hubMethodNotAllowed,
    },
  },
});
