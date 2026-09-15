import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/google-reviews")({
  server: {
    handlers: {
      GET: async () => {
        const { readGoogleReviews } = await import("@/lib/google-reviews.server");
        return Response.json(
          { data: await readGoogleReviews() },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
