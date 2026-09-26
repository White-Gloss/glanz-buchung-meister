import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/operator")({
  server: {
    handlers: {
      POST: () =>
        Response.json(
          { ok: false, error: "legacy_operator_endpoint_disabled" },
          { status: 410, headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
