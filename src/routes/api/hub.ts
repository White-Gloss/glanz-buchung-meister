import { createFileRoute } from "@tanstack/react-router";
import { handleHubInquiries } from "@/lib/hub-inquiries";

const retired = () => new Response(null, { status: 410 });

export const Route = createFileRoute("/api/hub")({
  server: {
    handlers: {
      GET: retired,
      POST: ({ request }) => handleHubInquiries(request),
    },
  },
});
