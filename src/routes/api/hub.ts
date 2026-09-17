import { createFileRoute } from "@tanstack/react-router";
import { handleHubRequest } from "@/lib/hub-sync";

export const Route = createFileRoute("/api/hub")({
  server: {
    handlers: {
      GET: ({ request }) => handleHubRequest(request),
      POST: ({ request }) => handleHubRequest(request),
    },
  },
});
