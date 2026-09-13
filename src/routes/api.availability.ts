import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/availability")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const from = url.searchParams.get("from") || "";
        const to = url.searchParams.get("to") || "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
          return Response.json({ ok: false, error: "invalid_range" }, { status: 400 });
        }
        try {
          const { calendarDateRange } = await import("@/lib/bitrix-calendar");
          let range;
          try {
            range = calendarDateRange(from, to);
          } catch {
            return Response.json({ ok: false, error: "invalid_range" }, { status: 400 });
          }
          const { getSql } = await import("@/lib/db");
          const { listBusyWindows } = await import("@/lib/zoho-ops");
          const sql = await getSql();
          const windows = await listBusyWindows(sql, range.from, range.to);
          return Response.json({ ok: true, windows }, { headers: { "cache-control": "no-store" } });
        } catch {
          return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
        }
      },
    },
  },
});
