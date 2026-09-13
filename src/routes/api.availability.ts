import { createFileRoute } from "@tanstack/react-router";
import { berlinWallToUtc } from "@/lib/zoho-time";

export const Route = createFileRoute("/api/availability")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const from = url.searchParams.get("from") || "";
        const to = url.searchParams.get("to") || "";
        const span = Date.parse(to) - Date.parse(from);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
          !Number.isFinite(span) ||
          span < 0 ||
          span > 366 * 86400000
        ) {
          return Response.json({ ok: false, error: "invalid_range" }, { status: 400 });
        }
        try {
          const { getSql } = await import("@/lib/db");
          const { listBusyWindows } = await import("@/lib/zoho-ops");
          const sql = await getSql();
          const windows = await listBusyWindows(
            sql,
            berlinWallToUtc(from, "00:00").toISOString(),
            berlinWallToUtc(to, "23:59").toISOString(),
          );
          return Response.json({ ok: true, windows }, { headers: { "cache-control": "no-store" } });
        } catch {
          return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
        }
      },
    },
  },
});
