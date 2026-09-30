import { createFileRoute } from "@tanstack/react-router";

const noStore = { "cache-control": "no-store" };

// Read-only transfer diagnostics for the inspect job on the server itself. Public
// requests (through Caddy or from other hosts) receive a plain 404.
export const Route = createFileRoute("/api/ro-diagnostics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getRequestIP } = await import("@tanstack/react-start/server");
        const { isLocalDiagnosticsRequest, roappDiagnostics } =
          await import("@/lib/roapp-diagnostics");
        // Socket address (srvx trusts no proxy headers here); never X-Forwarded-For.
        const ip = getRequestIP() ?? (request as Request & { ip?: string }).ip;
        if (!isLocalDiagnosticsRequest(ip, request.headers))
          return new Response("Not Found", { status: 404, headers: noStore });
        try {
          const { getSql } = await import("@/lib/db");
          const probe = new URL(request.url).searchParams.get("probe") === "1";
          return Response.json(await roappDiagnostics(await getSql(), { probe }), {
            headers: noStore,
          });
        } catch {
          console.error("[roapp-sync] diagnostics_endpoint_failed; keine Details protokolliert.");
          return Response.json(
            { ok: false, error: "diagnostics_failed" },
            {
              status: 500,
              headers: noStore,
            },
          );
        }
      },
    },
  },
});
